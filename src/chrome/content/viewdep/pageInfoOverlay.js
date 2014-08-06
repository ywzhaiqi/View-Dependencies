/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the View Dependencies extension for Page Info.
 *
 * The Initial Developer of the Original Code is
 *   Florian QUEZE <f.qu@queze.net>
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Large parts of this code are taken from pageInfo.js
 *
 * Contributor(s):
 *   Philip Chee <philip.chee@gmail.com>
 *   Diego Casorran <dcasorran@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

(function(scope){
const Cu = Components.utils;
Cu.import("resource://gre/modules/Services.jsm");

var aserv=Components.classes["@mozilla.org/atom-service;1"]
                    .getService(Components.interfaces.nsIAtomService);
var gIOService = Components.classes["@mozilla.org/network/io-service;1"]
                      .getService(Components.interfaces.nsIIOService);

// for firefox 32+, cache2
if ("@mozilla.org/netwerk/cache-storage-service;1" in Components.classes) {
  Cu.import("resource://gre/modules/LoadContextInfo.jsm");

  const nsICacheStorageService = Components.interfaces.nsICacheStorageService;
  const nsICacheStorage = Components.interfaces.nsICacheStorage;
  const cacheService = Components.classes["@mozilla.org/netwerk/cache-storage-service;1"].getService(nsICacheStorageService);

  var loadContextInfo = LoadContextInfo.fromLoadContext(
    window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
          .getInterface(Components.interfaces.nsIWebNavigation)
          .QueryInterface(Components.interfaces.nsILoadContext), false);
  var diskStorage = cacheService.diskCacheStorage(loadContextInfo, false);
} else {
  var gCacheService = Components.classes["@mozilla.org/network/cache-service;1"]
                        .getService(Components.interfaces.nsICacheService);
}

var viewdepBundle;
var gFrameTreeNumber = 0;
var gFinished = false;

function getDoc()
{
  return "gDocument" in window ? gDocument : theDocument;
}
function getWin()
{
  return "gWindow" in window ? gWindow : theWindow;
}


const cell1Text = 0,
      cell2Text = 1,
      isContainer = 2,
      isContainerOpen = 3,
      parentIndex = 4,
      hasNextSibling = 5,
      level = 6,
      cellProperties = 7;

const normal = 0, ital = 1, gr = 2, tgr = 4;

var contextMenu = {
  url: null,
  host: null
}

//******** define a js object to implement nsITreeView
var treeView = {
  columnids: ['ress', 'size'],
  colcount:2,
  TreeLinesCache:null,
  set rowCount(c) { throw "rowCount is a readonly property"; },
  get rowCount() { return LocationServers ? LocationServers.length : 0; },
  getPropFromLocationServers: function(indexProp, row, fun, secondParam)
  {
    if (this.TreeLinesCache) {
      if (row in this.TreeLinesCache) {
        if (indexProp in this.TreeLinesCache[row])
          return this.TreeLinesCache[row][indexProp];
      } else
        this.TreeLinesCache[row] = new Array();
      var res = fun(LocationServers, row, secondParam);
      this.TreeLinesCache[row][indexProp] = res;
      return res;
    }
    return fun(LocationServers, row, secondParam);
  },
  getCellText: function(row, column) {
    column = column.id || column;
    var index = (column == "DepRess") ? cell1Text : cell2Text;
    return this.getPropFromLocationServers(index, row, LocationServers.getCellText, column);
  },
  setTree: function(treebox){ this.treebox = treebox; },
  isContainer: function(row){
    return this.getPropFromLocationServers(isContainer, row, LocationServers.isContainer);
  },
  isContainerOpen: function(row){
    return this.getPropFromLocationServers(isContainerOpen, row, LocationServers.isContainerOpen);
  },
  isContainerEmpty: function(row){ return false; },
  getParentIndex: function(row) {
    return this.getPropFromLocationServers(parentIndex, row, LocationServers.getParentIndex);
  },
  hasNextSibling: function(row, afterRow){
    return this.getPropFromLocationServers(hasNextSibling, row, LocationServers.hasNextSibling, afterRow);
  },
  isSeparator: function(row){ return false; },
  isSorted: function(row){ return false; },
  cycleHeader: function(col) { },
  getLevel: function(row){
    return this.getPropFromLocationServers(level, row, LocationServers.getLevel);
  },
  getImageSrc: function(row,col){ return null; },
  getRowProperties: function(row,props){},
  getCellProperties: function(row,col,props)
  {
    if (!props) {
		props = {
			_xFpEz: [],
			AppendElement:function(e){ this._xFpEz.push(e); }
		};
    }
    if (row == 0) {
      props.AppendElement(aserv.getAtom("tgr"));
      if (LocationServers.dataSize <= 0)
         props.AppendElement(aserv.getAtom("ital"));
    }
    var res = this.getPropFromLocationServers(cellProperties, row, LocationServers.getCellProperties);
    if (res & ital)
      props.AppendElement(aserv.getAtom("ital"));
    if (res & gr)
      props.AppendElement(aserv.getAtom("gr"));
    if(props._xFpEz)
		return props._xFpEz.join(" ");
  },
  getColumnProperties: function(colid,col,props){},
  rowCountChanged: function(pos, nb)
  {
    if (nb && this.TreeLinesCache) {
      var row;
      if (nb < 0) {
        for (row = pos; row<=pos-nb; ++row) {
          delete this.TreeLinesCache[row];
        }
        while (row < LocationServers.length) {
          /* Rappel : nb < 0 ! */
          if (row in this.TreeLinesCache) {
            if (parentIndex in this.TreeLinesCache[row] &&
                this.TreeLinesCache[row][parentIndex] > pos)
              this.TreeLinesCache[row][parentIndex] += nb;
            this.TreeLinesCache[row+nb] = this.TreeLinesCache[row];
            delete this.TreeLinesCache[row];
          }
          ++row;
        }
      } else {
        for (row = LocationServers.length-1; row>=pos; --row) {
          if (row in this.TreeLinesCache) {
            if (parentIndex in this.TreeLinesCache[row] &&
                this.TreeLinesCache[row][parentIndex] >= pos)
              this.TreeLinesCache[row][parentIndex] += nb;
            this.TreeLinesCache[row+nb] = this.TreeLinesCache[row];
            delete this.TreeLinesCache[row];
          }
        }
      }
    }
    LocationServers.length += nb;
    treeView.treebox.rowCountChanged(pos, nb);
  },
  toggleOpenState: function(row)
  {
    if (this.TreeLinesCache && (row in this.TreeLinesCache))
      delete this.TreeLinesCache[row][isContainerOpen];
    if (row == 0) {
      if (LocationServers.open) {
        LocationServers.open = false;
        treeView.treebox.rowCountChanged(1, 1 - LocationServers.length);
      } else {
        LocationServers.open = true;
        treeView.treebox.rowCountChanged(1, LocationServers.length - 1);
      }
      return;
    }
    var i, j, l;
    var pos = 1;
    for (i in LocationServers.data) {
      l = LocationServers.data[i].getLength();
      if (row == pos) {
        if (LocationServers.data[i].open) {
          LocationServers.data[i].open = false;
          this.rowCountChanged(pos + 1, 1 - LocationServers.data[i].length);
        } else {
          LocationServers.data[i].open = true;
          this.rowCountChanged(pos + 1, LocationServers.data[i].length - 1);
        }
      return;
      }
      if (pos + l > row) {
        LocationServers.data[i].toggleOpenState(row, pos);
        return;
      }
      pos += l;
    }
  },
  makeContextMenu: function(row) {
    if (row == 0) {
      contextMenu.url = LocationServers.url.spec;
      try {
        contextMenu.host = LocationServers.url.host;
      } catch (e) {
        contextMenu.host = LocationServers.url.scheme;
      }
      return true;
    }
    var i, l;
    row--;
    for (i in LocationServers.data) {
      l = LocationServers.data[i].getLength();
      if (l > row)
        return LocationServers.data[i].makeContextMenu(row);
      row -= l;
    }
    return false;
  }
};




function ImageNode(type, url, size)
{
  this.length = 1;
  this.container = false;
  this.open = true;
  this.data = {};
  this.type = type;
  this.data[url.spec] = size;
  this.nbCachedElem = (size > 0);
  this.dataSize = size;
  this.count = 1;
  LocationServers.count++;
}


ImageNode.prototype = {
  AddUrl: function(url, size)
  //la valeur retournée correspond au nombre de lignes visibles ajoutées dans l'arbre.
  {
    // si on a déjà l'url dans l'objet.
    if (url.spec in this.data) {
      return 0;
      //plus tard, si gestion d'un compteur, incrémenter.
    }

    this.data[url.spec] = size;
    this.dataSize += size;
    if (size > 0)
      this.nbCachedElem++;
    this.length++;
    this.count++;
    LocationServers.count++;
    if (this.container) {
      return 1;
    } else {
      this.container = true;
      return 2;
    }
  },
  getLength: function()
  {
    if (!this.container || !this.open)
      return 1;
    return 1 + this.length;
  },
  getCellText: function(row, column)
  {
    if (row == 0) {
      if (column == "DepRess") {
        if (this.length > 1)
          return this.type + (gFinished ? ' ('+this.count+')' : '');
        for (i in this.data)  // s'arrêtera de toute façon à la première itération.
          return '['+this.type+'] '+i;
      }
      if (!gFinished)
        return viewdepBundle.getString("unknown");
      if (this.length > 1 )
        return FormatSize(this.dataSize);
      else
        return '   '+FormatSize(this.dataSize);
    }
    row--;
    var i, l;
    for (i in this.data) {
      if (row > 0) {
        row--;
      } else {
        if (column == "DepRess")
          return i;
        return '   '+FormatSize(this.data[i]);
      }
    }
    return 'error ImageNode';
  },
  hasNextSibling: function(row)
  {
    var NextReturnTrue = false;
    row--;
    var i, l;
    for (i in this.data) {
      if (NextReturnTrue)
        return true;
      if (row == 0) {
        NextReturnTrue = true;
        continue;
      }
      row--;
    }
    return false;
  },
  getCellProperties: function(row)
  {
    var i;
    row--; // row is always >= 1 because ServerNode::getCellProperties handles the case row == 0
    for (i in this.data) {
      if (row == 0) {
        if (this.data[i] <= 0)
          return ital;
        return normal;
      }
      row--;
    }
    return normal; // to avoid JS strict warning
  },
  makeContextMenu: function(row)
  {
    var i;
    if (row == 0) {
      if (this.length > 1)
        return false;
      for (i in this.data) { // s'arrêtera de toute façon à la première itération.
        contextMenu.url = i;
        return true;
      }
    }
    row--;
    for (i in this.data) {
      if (row > 0) {
        row--;
      } else {
        contextMenu.url = i;
        return true;
      }
    }
    return false;
  },
  unCache: function(row, firstRow, parentOpen)
  {
    if (!this.nbCachedElem)
      return false;
    var i;
    if (row == 0)
    {
      if (parentOpen)
        unCacheRefresh(firstRow++);
      for (i in this.data)
      {
        if (this.data[i] > 0)
        {
          this.data[i] *= -1;
          GetCache(i, function(cacheEntry) {
            if (cacheEntry)
              cacheEntry.doom();
          });
          if (parentOpen && this.open && this.container)
            unCacheRefresh(firstRow);
        }
        firstRow++;
      }
      this.nbCachedElem = 0;
      return true;
    } else {
      row--;
      var l = firstRow+1;
      for (i in this.data)
      {
        if (row == 0)
        {
          if (this.data[i] <= 0)
            return false;
          this.data[i] *= -1;
          GetCache(i, function(cacheEntry) {
            if (cacheEntry)
              cacheEntry.doom();
          });
          this.nbCachedElem--;
          unCacheRefresh(l);
          break;
        }
        row--;
        l++;
      }
      if (this.nbCachedElem)
        return false;
      else {
        unCacheRefresh(firstRow);
        return true;
      }
    }
  },
  updateSize: function() {}
}


function ServerNode(hostname)
{
  this.data = {};
  this.hostname = hostname;
  this.dataSize = 0;
  this.open = true;
  this.length = 1;
  this.count = 0;
}

ServerNode.prototype = {
  addUrl: function(type, url, size, indexBase)
  //la valeur retournée correspond au nombre de lignes visibles ajoutées dans l'arbre.
  {
    var res = 0;
    if (!(type in this.data)) {
      this.data[type] = new ImageNode(type, url, size);
      if (size > 0)
        this.dataSize += size;
      if (this.open) {
        treeView.treebox.rowCountChanged(indexBase + this.length, 1);
        res = 1;
      } else {
        res = -1;
      }
      this.length++;
      this.count++;
    } else {
      var partLength = 1;
      var i;
      for (i in this.data) {
        partLength += this.data[i].getLength();
        if (i == type)
          break;
      }
      res = this.data[type].AddUrl(url, size);
      if (res > 0) {
        if (size > 0)
          this.dataSize += size;
        if (this.data[type].open) {
          this.length += res;
          if (this.open) {
            treeView.treebox.rowCountChanged(indexBase + partLength -1, res);
          } else {
            res = -res;
          }
        } else {
          res = -res;
        }
        this.count++;
      }
    }
    return res;
  },
  getLength: function()
  {
    if (this.open)
      return this.length;
    return 1;
  },
  getCellText: function(row, column) {
    if (row == 0) {
      if (column == "DepRess")
        return this.hostname + (gFinished ? ' ('+this.count+')' : '');
      return gFinished ? FormatSize(this.dataSize) : viewdepBundle.getString("unknown");
    }
    row--;   // pour ne pas compter la ligne contenant le nom du serveur
    var i, l;
    for (i in this.data) {
      l = this.data[i].getLength();
      if (l > row)
        return this.data[i].getCellText(row, column);
      row -= l;
    }
    return 'error ServerNode';
  },
  getParentIndex: function(row, aPos) {
    var pos = aPos + 1;
    var i, l;
    for (i in this.data) {
      if (row == pos)
        return aPos;
      l = this.data[i].getLength();
      if (pos + l > row)
        return pos;
      pos += l;
    }
    return -1; //erreur
  },
  toggleOpenState: function(row, pos) {
    pos++;
    var i, l;
    for (i in this.data) {
      if (row == pos) {
        if (this.data[i].open) {
          this.data[i].open = false;
          this.length -= this.data[i].length;
          treeView.rowCountChanged(pos + 1, -this.data[i].length);
          return;
        } else {
          this.data[i].open = true;
          this.length += this.data[i].length;
          treeView.rowCountChanged(pos + 1, this.data[i].length);
          return;
        }
      }
      l = this.data[i].getLength();
      if (pos + l > row)
        return;
      pos += l;
    }
  },
  hasNextSibling: function(row){
    var NextReturnTrue = false;
    row--;
    var i, l;
    for (i in this.data) {
      if (NextReturnTrue)
        return true;
      if (row == 0) {
        NextReturnTrue = true;
        continue;
      }
      l = this.data[i].getLength();
      if (l > row)
        return this.data[i].hasNextSibling(row);
      row -= l;
    }
    return false;
  },
  getLevel: function(row){
    // row > 0 car déjà testé avant l'appel
    var i, l;
    row--;
    for (i in this.data) {
      if (row == 0)
        return 1;
      l = this.data[i].getLength();
      if (l > row)
        return 2;
      row -= l;
    }
    return 0; // on devrait déjà être sorti. 0 indique une erreur s'il n'est pas sur la première ligne.
  },
  isContainer: function(row){
    // row > 0 car déjà testé avant l'appel
    row--;
    var i, l;
    for (i in this.data) {
      if (row == 0)
        return (this.data[i].length > 1);
      l = this.data[i].getLength();
      if (l > row)
        return false;
      row -= l;
    }
    return false; // on devrait déjà être sorti. 0 indique une erreur s'il n'est pas sur la première ligne.
  },
  isContainerOpen: function(row){
    // row > 0 car déjà testé avant l'appel
    row--;
    var i, l;
    for (i in this.data) {
      if (row == 0)
        return (this.data[i].open);
      l = this.data[i].getLength();
      if (l > row)
        return false;
      row -= l;
    }
    return false; // erreur. on devrait déjà être sorti.
  },
  getCellProperties: function(row){
    var i, l;
    row--;
    for (i in this.data) {
      if (row == 0)
        return (this.data[i].nbCachedElem > 0) ? normal : ital;
      l = this.data[i].getLength();
      if (l > row)
        return this.data[i].getCellProperties(row);
      row -= l;
    }
    return normal; // to avoid JS strict warning
  },
  makeContextMenu: function(row) {
    contextMenu.host = this.hostname;
    if (row == 0) {
      contextMenu.url = null;
      return true;
    }
    row--;   // pour ne pas compter la ligne contenant le nom du serveur
    var i, l;
    for (i in this.data) {
      l = this.data[i].getLength();
      if (l > row)
        return this.data[i].makeContextMenu(row);
      row -= l;
    }
    return false;
  },
  unCache: function(row, firstRow)
  {
    var i, l = firstRow+1;
    if (row == 0)
    {
      for (i in this.data)
      {
        this.data[i].unCache(0, l, this.open)
        l += this.data[i].getLength();
      }
    } else {
      row--;
      for (i in this.data)
      {
        var l2 = this.data[i].getLength();
        if (l2 > row)
        {
            if (this.data[i].dataSize <= 0)
              return false;
            this.data[i].unCache(row, l, true);
            break;
        }
        row -= l2;
        l   += l2;
      }
      for (i in this.data)
        if (this.data[i].nbCachedElem > 0)
          return false;
    }
    /* la première ligne doit passer en gris (sinon on a déjà renvoyé false */
    this.dataSize *= -1;
    unCacheRefresh(firstRow);
    return true;
  },
  updateSize: function()
  {
/*
    var i;
    for (i in this.data)
      this.data[i].updateSize();
*/
  }
};





function LocationServerNodes(url)
{
    this.url = url;
    this.data = {};
    this.dataSize = 0;
    this.open = true;
    this.length = 1; // la première ligne contient l'url de base.
    treeView.treebox.rowCountChanged(0, 1);
    this.count = 0;
    this.TreeLinesCache = null;
}

LocationServerNodes.prototype = {
  getCellText: function(ptr, row, column)
  {
    if (row == 0) {
      if (column == "DepRess")
        return ptr.url.spec + (gFinished ? ' ('+ptr.count+')' : '');
      return gFinished ? FormatSize(ptr.dataSize) : viewdepBundle.getString("unknown");
    }
    var i, l;
    row--;
    for (i in ptr.data) {
      l = ptr.data[i].getLength();
      if (l > row)
        return ptr.data[i].getCellText(row, column);
      row -= l;
    }
    return 'Tree error';
  },
  isContainer: function(ptr, row)
  {
    if (row == 0)
      return true;
    var i, l;
    row--;
    for (i in ptr.data) {
      if (row == 0)
        return true;
      l = ptr.data[i].getLength();
      if (l > row)
        return ptr.data[i].isContainer(row);
      row -= l;
    }
    return false;
  },
  isContainerOpen: function(ptr, row)
  {
    if (row == 0)
      return ptr.open;
    var i, l;
    row--;
    for (i in ptr.data) {
      if (row == 0)
        return ptr.data[i].open;
      l = ptr.data[i].getLength();
      if (l > row)
        return ptr.data[i].isContainerOpen(row);
      row -= l;
    }
    return false; //erreur
  },
  getParentIndex: function(ptr, row)
  {
    if (row == 0)
      return -1;
    var i, l;
    var pos = 1;
    for (i in ptr.data) {
      if (row == pos)
        return 0;
      l = ptr.data[i].getLength();
      if (pos + l > row)
        return ptr.data[i].getParentIndex(row, pos);
      pos += l;
    }
    return 0; // erreur
  },
  hasNextSibling: function(ptr, row, afterRow)
  {
    if (row == 0)
      return false;
    var NextReturnTrue = false;
    row--;
    var i, l;
    for (i in ptr.data) {
      if (NextReturnTrue)
        return true;
      if (row == 0) {
        NextReturnTrue = true;
        continue;
      }
      l = ptr.data[i].getLength();
      if (l > row)
        return ptr.data[i].hasNextSibling(row);
      row -= l;
    }
    return false;// erreur
  },
  getLevel: function(ptr, row){
    if (row == 0)
      return 0;
    var i, l;
    row--;
    for (i in ptr.data) {
      l = ptr.data[i].getLength();
      if (row == 0)
        return 1;
      if (l > row)
        return 1 + ptr.data[i].getLevel(row);
      row -= l;
    }
    return 0; // on devrait déjà être sorti. 0 indique une erreur s'il n'est pas sur la première ligne.
  },
  getCellProperties: function(ptr, row)
  {
    if (row == 0)
      return tgr;
    var i, l;
    row--;
    for (i in ptr.data) {
      if (row == 0) {
        var res = gr;
        if (ptr.data[i].dataSize <= 0)
          res += ital;
        return res;
      }
      l = ptr.data[i].getLength();
      if (l > row)
        return ptr.data[i].getCellProperties(row);
      row -= l;
    }
    return normal; // to avoid JS strict warning
  },
  unCache: function(row)
  {
    if (this.dataSize <= 0)
      return;
    var i, l = 1;
    if (row == 0)
    {
      for (i in this.data)
      {
        this.data[i].unCache(0, l);
        l += this.data[i].getLength();
      }
    } else {
      row--;
      for (i in this.data)
      {
        var l2 = this.data[i].getLength();
        if (l2 > row)
        {
            if (this.data[i].dataSize <= 0)
              return;
            this.data[i].unCache(row, l);
            break;
        }
        row -= l2;
        l   += l2;
      }
      for (i in this.data)
        if (this.data[i].dataSize > 0)
          return;
    }
    /* la première ligne doit passer en gris */
    unCacheRefresh(0);
  },
  addRow: function(url, type, size)
  {
    var hostname;
    try {
      hostname = url.host || url.scheme;
    } catch (e) {
      hostname = url.scheme;
    }
    if (!(hostname in this.data)) {
      this.data[hostname] = new ServerNode(hostname);
      if (this.open)
        treeView.treebox.rowCountChanged(this.length, 1);
      this.length++;
    }
    var partLength = 1;
    var i;
    for (i in this.data) {
      if (i == hostname)
        break;
      partLength += this.data[i].getLength();
    }

    var res = this.data[hostname].addUrl(type, url, size, partLength);
    if (res) {
      if (size > 0)
        this.dataSize += size;
      if (res > 0)
       this.length += res;
    }
  },
  updateSizes: function()
  {
    treeView.treebox.invalidate();
  /*
    var i;
    for (i in this.data)
      this.data[i].updateSize();
  */

  }
};



var LocationServers = null;
var gNewPageInfo = "onProcessFrame" in window && "onProcessElement" in window && "onFinished" in window;
if (gNewPageInfo) {
  onProcessFrame.push(LocProcessFrame);
  onProcessElement.push(grabAllElem);
  onFinished.push(LocFinish);
}

function resetDepTab()
{
  var ViewDepProgressMeter = document.getElementById("DepTabProgressMeter");
  ViewDepProgressMeter.removeAttribute("hidden");
  gFinished = false;
  treeView.TreeLinesCache = null;
  treeView.treebox.rowCountChanged(0, -LocationServers.length);
  LocationServers = null;
}
if ("onResetRegistry" in window)
  onResetRegistry.push(resetDepTab);

function initDepTab()
{
  if (LocationServers)
    return;

  viewdepBundle = document.getElementById("viewdepbundle");
  if (!gIOService)
    gIOService = Components.classes["@mozilla.org/network/io-service;1"]
                           .getService(Components.interfaces.nsIIOService);

  document.getElementById('DepTree').view = treeView;
  var ServBaseURI = gIOService.newURI(getDoc().location.href, null, null);
  LocationServers = new LocationServerNodes(ServBaseURI);

  //chargement des données
  if (!gNewPageInfo)
    setTimeout(FillLocTree, 1, getDoc(), getWin());
}

function LocFinish()
{
  gFinished = true;
  LocationServers.updateSizes();

  /* Commenter la ligne suivante permet de désactiver la mise en cache de l'arbre */
  treeView.TreeLinesCache = new Array(LocationServers.length);

  /* endroit pour ajouter des trucs à exécuter à la fin de l'ajout de lignes dans l'arbre. */

  var ViewDepProgressMeter = document.getElementById("DepTabProgressMeter");
  ViewDepProgressMeter.setAttribute("hidden", true);
 }

function LocProcessFrame(aDocument)
{
  if (!LocationServers)
    initDepTab();

  if (aDocument.contentType.indexOf('image') != 0)
    AddTogList(aDocument.location.href, "html");
}

function FillLocTree(aDocument, aWindow)
{
  LocProcessFrame(aDocument);
  if (aWindow && aWindow.frames.length > 0) {
    var num = aWindow.frames.length;
    for (var i = 0; i < num; i++)
      FillLocTree(aWindow.frames[i].document, aWindow.frames[i]);  // recurse through the frames
  }

  gFrameTreeNumber++;
  var locIterator = aDocument.createTreeWalker(aDocument, NodeFilter.SHOW_ELEMENT, grabAllElem, true);
  setTimeout(LocDoGrab, 1, locIterator);
}


function LocDoGrab(locIterator)
{
  for (var i = 0; i < 50; ++i)
    if (!locIterator.nextNode()) {
      if (gFrameTreeNumber > 1)
        gFrameTreeNumber--;
      else
        LocFinish();
      return;
    }
  setTimeout(LocDoGrab, 1, locIterator);
}


function grabAllElem(elem)
{
  var URI;
  var baseURI;
  // check for background images, any node may have one
  if (elem.ownerDocument.defaultView) {
    var ComputedStyle = elem.ownerDocument.defaultView.getComputedStyle(elem, "");
    if (ComputedStyle) {
      var url = ComputedStyle.getPropertyCSSValue("background-image");
      if (url) {
        function addBackground(url) {
          AddTogList(url.getStringValue(), viewdepBundle.getString("background"));
        }
        if (url instanceof CSSValueList) // Gecko 1.9.2+
          Array.forEach(url, addBackground);
        else if (url.primitiveType == CSSPrimitiveValue.CSS_URI) // Gecko < 1.9.2
          addBackground(url);
      }
      url = ComputedStyle.getPropertyCSSValue("list-style-image");
      if (url && (url.primitiveType == CSSPrimitiveValue.CSS_URI))
        AddTogList(url.getStringValue(), viewdepBundle.getString("image"));
    }
  }

  if (elem instanceof HTMLImageElement) {
    if (elem.hasAttribute("src"))
      AddTogList(elem.src, viewdepBundle.getString("image"), elem.baseURI);
  } else if (elem instanceof HTMLLinkElement) {
    if (elem.rel && elem.hasAttribute("href")) {
      var rel = elem.rel;
      if (/\bicon\b/i.test(rel))
        AddTogList(elem.href, viewdepBundle.getString("icon"), elem.baseURI);
      else if (/\bstylesheet\b/i.test(rel)) {
        AddTogList(elem.href, viewdepBundle.getString("stylesheet"), elem.baseURI);
        goThroughCSSStyleSheet(elem.sheet);
      } else
        ;//AddTogList(URI, "linkRel");
    }
    //else
    //  AddTogList(elem.href, "linkRev", elem.baseURI);
  } else if ((elem instanceof HTMLInputElement || elem instanceof HTMLButtonElement) && (elem.type.toLowerCase() == "image")) {
    if (elem.hasAttribute("src"))
      AddTogList(elem.src, viewdepBundle.getString("inputImage"), elem.baseURI);
  } else if (elem instanceof HTMLAppletElement) {
    //XXX When Java is enabled, the DOM model for <APPLET> is broken. Bug #59686.
    // Also, some reports of a crash with Java in Media tab (bug 136535), and mixed
    // content from two hosts (bug 136539) so just drop applets from Page Info when
    // Java is on. For the 1.0.1 branch; get a real fix on the trunk.
    if (!navigator.javaEnabled() && (elem.hasAttribute("code") || elem.hasAttribute("object"))) {
      var baseURI = elem.hasAttribute("codebase") ? gIOService.newURI(elem.baseURI, null, null)
                                                              .resolve(elem.getAttribute("codebase"))
                                                  : elem.baseURI;
      AddTogList(elem.code || elem.object, viewdepBundle.getString("applet"), baseURI);
    }
  } else if (elem instanceof HTMLObjectElement) {
    if (elem.hasAttribute("data"))
      AddTogList(elem.data, viewdepBundle.getString("object"), elem.baseURI);
  } else if (elem instanceof HTMLEmbedElement) {
    if (elem.hasAttribute("src"))
      AddTogList(elem.src, viewdepBundle.getString("Embed"), elem.baseURI);
  } else if (elem instanceof HTMLScriptElement) {
    if (elem.hasAttribute("src"))
      AddTogList(elem.src, viewdepBundle.getString("script"), elem.baseURI);
/*
  } else if (elem instanceof HTMLFrameElement || elem instanceof HTMLIFrameElement) {
    AddTogList(elem.src, "html", elem.baseURI);
*/
  } else if (elem instanceof HTMLFrameElement) {
    if (elem.hasAttribute("src"))
      AddTogList(elem.src, viewdepBundle.getString("frame"), elem.baseURI);
  } else if (elem instanceof HTMLIFrameElement) {
    if (elem.hasAttribute("src"))
      AddTogList(elem.src, viewdepBundle.getString("iframe"), elem.baseURI);
  } else if (elem instanceof HTMLStyleElement) {
    goThroughCSSStyleSheet(elem.sheet);
  }
  return NodeFilter.FILTER_ACCEPT;
}

/* See https://bugzilla.mozilla.org/show_bug.cgi?id=173923#c3 */
function goThroughCSSStyleSheet(css)
{
  if (!css)
    /*
      it happens when stylesheet a imports stylesheet b which imports stylesheet a.
      Then, the member styleSheet of b's import rule is null
    */
    return;
  try {
    var rules = css.cssRules;
    var i;
    for (i in rules)
      if (rules[i] instanceof CSSImportRule)
      {
        AddTogList(rules[i].href, viewdepBundle.getString("stylesheet"), css.href);
        goThroughCSSStyleSheet(rules[i].styleSheet);
      }
  } catch(e) {
  /*
    "css.cssRules" sometimes throw this when the stylesheet can't be loaded:
    Exception... "A parameter or an operation is not supported by the underlying object"
    code: "15" nsresult: "0x8053000f (NS_ERROR_DOM_INVALID_ACCESS_ERR)"
  */
  }
}


function AddTogList(url, FileType, aBaseURI)
{
  try {
    var URI;
    url = url.replace(/#.*$/, "");
    if (aBaseURI) {
      var baseURI = gIOService.newURI(aBaseURI, null, null);
      URI = gIOService.newURI(baseURI.resolve(url), null, null);
    } else {
      URI = gIOService.newURI(url, null, null);
    }

    GetCache(URI, function(cache) {
      if (cache) {
        var redir = (/^Location:\s*(.*?)\s*(?:\;|$)/mi
                    .exec(cache.getMetaDataElement("response-head")));
        if (redir) {
          AddTogList(redir[1], FileType, URI.spec);
          FileType = viewdepBundle.getString("redir");
        }
        LocationServers.addRow(URI, FileType, cache.dataSize);
      } else
        LocationServers.addRow(URI, FileType, 0);
    });
  } catch(e) {
  }
}

function makeMenu()
{
  var row = treeView.selection.currentIndex;
  var res = treeView.makeContextMenu(row);
  var prop = treeView.getPropFromLocationServers(cellProperties, row, LocationServers.getCellProperties);
  var rmCache = !(prop & ital);
  document.getElementById("DepNewTab").hidden     = !res;
  document.getElementById("DepNewWin").hidden     = !res;
  document.getElementById("DepCopySep").hidden    = !res;
//  document.getElementById("DepCopyAll").hidden    = row;
  document.getElementById("DepCopyUrl").hidden    = !res || !contextMenu.url;
  document.getElementById("DepCopyHost").hidden   = !res;
  document.getElementById("DepRmCacheSep").hidden = !rmCache; // || !res;
  document.getElementById("DepRmCache").hidden    = !rmCache;
  return true; //res || rmCache;
}

function onOpen(where)
{
  var url = contextMenu.url || (contextMenu.host);
  (contextMenu.url)
  if (where == 1)
    //open link in new window
    window.open(url, getDoc());
  else{
    // open link in new tab
    var browser;
    if (window.opener) {
      browser = window.opener.gBrowser;
    } else {
      var windowMediator =
        Components.classes["@mozilla.org/appshell/window-mediator;1"]
        .getService(Components.interfaces.nsIWindowMediator);
      var browserWin = windowMediator.getMostRecentWindow("navigator:browser");
      if (!browserWin) {
        throw "Unable to get Browser";
        return;
      }
      browser = browserWin.getBrowser();
    }
    browser.selectedTab = browser.addTab(url, null, getDoc());
  }
}


function onCopy(what)
{
  var copytext = (what == 1) ? contextMenu.host : contextMenu.url;
  doCopyText(copytext);
}

function doCopyText(copytext)
{
  var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
  if (!str) return false;
  str.data=copytext;

  var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
  if (!trans) return false;

  trans.addDataFlavor("text/unicode");
  trans.setTransferData("text/unicode",str,copytext.length*2);

  var clipid=Components.interfaces.nsIClipboard;
  var clip = Components.classes["@mozilla.org/widget/clipboard;1"].getService(clipid);
  if (!clip) return false;

  clip.setData(trans,null,clipid.kGlobalClipboard);

  return true;
}

function onCopyAll()
{
  var copytext =  "";
  copytext += LocationServers.url.spec + (gFinished ? ' ('+LocationServers.count+')' : '') + "\t";
  copytext += (gFinished ? FormatSize(LocationServers.dataSize) : viewdepBundle.getString("unknown")) + "\n";
  for (var i in LocationServers.data) {
    var serverNode = LocationServers.data[i];
    copytext += " " + serverNode.hostname + (gFinished ? ' ('+serverNode.count+')' : '') + "\t";
    copytext += (gFinished ? FormatSize(serverNode.dataSize) : viewdepBundle.getString("unknown")) + "\n";
    for (var j in serverNode.data) {
      imageNode = serverNode.data[j];
      copytext += "  " + imageNode.type + (gFinished ? ' ('+imageNode.count+')' : '')+ "\t";
      copytext += (gFinished ? FormatSize(imageNode.dataSize) : viewdepBundle.getString("unknown")) + "\n";
      for (var k in imageNode.data) {
        copytext += "   " + k + "\t";
        copytext += FormatSize(imageNode.data[k]) + "\n";
      }
    }
  }
  doCopyText(copytext);
}

function onUnCache()
{
  var row = treeView.selection.currentIndex;
  LocationServers.unCache(row);
}

function unCacheRefresh(row)
{
    if (treeView.TreeLinesCache &&
        (row in treeView.TreeLinesCache) &&
        (cellProperties in treeView.TreeLinesCache[row]))
      treeView.TreeLinesCache[row][cellProperties] += ital;
    //... .Invalidate();
}

function GetCache(uriOrUrl, callback) {
  var uri, url;
  if (typeof uriOrUrl == 'string') {
    url = uriOrUrl;
    uri = Services.io.newURI(url, null, null);
  } else {
    uri = uriOrUrl;
    url = uriOrUrl.spec;
  }

  if (uri.scheme === 'file') {
    var file = uri.QueryInterface(Components.interfaces.nsIFileURL).file;
    var entry = {
      dataSize: file.fileSize,
      getMetaDataElement: function() {},
      doom: function() {}
    };
    callback(entry);
    return;
  } else if (uri.scheme === 'chrome') {
    callback(null);
    return;
  }

  if (diskStorage) {  // ff32+
    var checkCacheListener = {
      onCacheEntryCheck: function(entry, appCache) {
        return Components.interfaces.nsICacheEntryOpenCallback.ENTRY_WANTED;
      },
      onCacheEntryAvailable: function(entry, isNew, appCache, status) {
        callback(entry);
      }
    };
    diskStorage.asyncOpenURI(uri, "", nsICacheStorage.OPEN_READONLY, checkCacheListener);
  } else {
    const ACCESS_READ = Components.interfaces.nsICache.ACCESS_READ;
    try {
      var httpCacheSession = gCacheService.createSession("HTTP", Components.interfaces.nsICache.STORE_ANYWHERE, true);
      httpCacheSession.asyncOpenCacheEntry(url, ACCESS_READ, {
        onCacheEntryAvailable: function(entry, access, status) {
          if (entry)
            callback(entry);
          else {
            var ftpCacheSession = gCacheService.createSession("FTP", Components.interfaces.nsICache.STORE_ANYWHERE, true);
            ftpCacheSession.asyncOpenCacheEntry(url, ACCESS_READ, {
              onCacheEntryAvailable: function(entry, access, status) {
                callback(entry);
              }
            }, true);
          }
        }
      }, true);
    } catch (ex) {
      // console.log(ex);
      callback(null);
    }
  }
}

function FormatSize(aSize)
{
  if (!aSize)
    return viewdepBundle.getString("unknown");
  if (aSize < 0)
    aSize *= -1;
  if (aSize > 1024)
    return viewdepBundle.getFormattedString("kilobytes", [(Math.round(aSize/1024*100)/100).toLocaleString()]);
  return viewdepBundle.getFormattedString("bytes", [(aSize).toLocaleString()]);
}

scope.viewdep = {
	initDepTab : initDepTab,
	showTab    : showTab,
	onOpen     : onOpen,
	onCopyAll  : onCopyAll,
	onCopy     : onCopy,
	onUnCache  : onUnCache,
	makeMenu   : makeMenu
};

})(this);
