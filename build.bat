REM ����һ���Զ������ xpi �������Ҫ�� 7z �����֧��

CD src
7z a 1.zip *
MOVE 1.zip ..
CD ..
DEL View-Dependencies.xpi
RENAME 1.zip View-Dependencies.xpi