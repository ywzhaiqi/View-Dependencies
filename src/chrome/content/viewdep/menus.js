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

(function(){
var prefManager = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefBranch);

function viewdep_show()
{
  BrowserPageInfo(null, 'DepTab');
}
window.viewdep_show = viewdep_show;

function viewdep_addEvents()
{
  var ctxMenu = document.getElementById("contentAreaContextMenu");
  ctxMenu.addEventListener('popupshowing', viewdep_contextMenu, false);
  var toolsMenu = document.getElementById("menu_ToolsPopup") ||
                  document.getElementById("menu_View_Popup");
  toolsMenu.addEventListener('popupshowing', viewdep_toolsMenu, false);
}

function viewdep_contextMenu(event)
{
  viewdep_aboutToShow("viewdep_contextMenu", "extensions.viewdep.hideContextMenu");
}

function viewdep_toolsMenu(event)
{
  if (viewdep_aboutToShow("viewdep_toolMenu", "extensions.viewdep.hideToolsMenu"))
    return;
  var popup = event.target;
  if (popup.id == "menu_View_Popup" )
  {
    var viewItem = document.getElementById("viewdep_toolMenu");
    var pageItem = popup.getElementsByAttribute("command", "View:PageInfo");
    if (pageItem)
    {
      var ref = pageItem[0].nextSibling;
      if (ref)
        popup.insertBefore(viewItem, pageItem[0].nextSibling);
    }
  }
}

function viewdep_aboutToShow(itemId, prefName)
{
  var item;
  var hide = (prefManager.getPrefType(prefName) != prefManager.PREF_BOOL)
              || prefManager.getBoolPref(prefName);
  if ((item = document.getElementById(itemId)))
    item.hidden = hide;
  return hide;
}

window.addEventListener("load", viewdep_addEvents, true);
})();
