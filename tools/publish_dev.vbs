Set objShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Determine script folder
scriptFull = WScript.ScriptFullName
scriptFolder = fso.GetParentFolderName(scriptFull)

' Find project root by walking up until index.html is found (or drive root)
Function findProjectRoot(startFolder)
  cur = startFolder
  Do
    candidate = fso.BuildPath(cur, "index.html")
    If fso.FileExists(candidate) Then
      findProjectRoot = cur
      Exit Function
    End If
    parent = fso.GetParentFolderName(cur)
    If parent = "" Or parent = cur Then Exit Do
    cur = parent
  Loop
  findProjectRoot = startFolder ' fallback
End Function

' Determine project root from script folder
projectRoot = findProjectRoot(scriptFolder)
 ' Ask for source and destination paths (provide sensible defaults)
 On Error Resume Next
 defaultSrc = objShell.ExpandEnvironmentStrings("%MESOBUILDER_EXTERNAL_PATH%")
 If defaultSrc = "" Then defaultSrc = "C:\\"
 On Error Goto 0

 If WScript.Arguments.Count >= 1 Then
   defaultSrc = WScript.Arguments(0)
 End If

 ' Browse-for-folder helper (falls back to empty string)
 Function browseForFolder(prompt, defaultPath)
   Dim sh, fld
   On Error Resume Next
   Set sh = CreateObject("Shell.Application")
   If defaultPath <> "" Then
     Set fld = sh.BrowseForFolder(0, prompt, &H0011, defaultPath)
   Else
     Set fld = sh.BrowseForFolder(0, prompt, &H0011, 0)
   End If
   On Error Goto 0
   If IsObject(fld) Then
     On Error Resume Next
     browseForFolder = fld.Self.Path
     If Err.Number <> 0 Then browseForFolder = ""
     On Error Goto 0
   Else
     browseForFolder = ""
   End If
 End Function

 src = browseForFolder("Seleccione la carpeta de origen (proyecto externo):", defaultSrc)
 If src = "" Then
   ' fallback to typed input
   src = InputBox("Ruta de origen (carpeta con el proyecto a publicar):", "publish_dev - Origen", defaultSrc)
 End If
 If src = "" Then
   objShell.Popup "No se proporcionó ruta origen. Abortando.", 5, "publish_dev", 48
   WScript.Quit 1
 End If
 If Not fso.FolderExists(src) Then
   objShell.Popup "La carpeta origen no existe: " & src, 6, "publish_dev", 48
   WScript.Quit 1
 End If

 destDefault = projectRoot
 dest = browseForFolder("Seleccione la carpeta de destino (donde copiar los archivos):", destDefault)
 If dest = "" Then
   dest = InputBox("Ruta de destino (donde copiar los archivos):", "publish_dev - Destino", destDefault)
 End If
 If dest = "" Then
   objShell.Popup "No se proporcionó ruta destino. Abortando.", 5, "publish_dev", 48
   WScript.Quit 1
 End If
 If Not fso.FolderExists(dest) Then
   resp = objShell.Popup("La carpeta destino no existe: " & dest & vbCrLf & "Crearla?", 4 + 32, "publish_dev")
   If resp = 6 Then
     On Error Resume Next
     fso.CreateFolder(dest)
     If Err.Number <> 0 Then
       objShell.Popup "No se pudo crear la carpeta destino: " & dest, 16, "publish_dev", 48
       WScript.Quit 1
     End If
     On Error Goto 0
   Else
     WScript.Quit 1
   End If
' Exclude list
Dim excludes
excludes = Array("node_modules", ".git")

Function isExcluded(name)
  For Each e In excludes
    If LCase(e) = LCase(name) Then
      isExcluded = True
      Exit Function
    End If
  Next
  isExcluded = False
End Function

' Copy files and folders
Set srcFolder = fso.GetFolder(src)
Set files = srcFolder.Files
For Each f In files
  destFile = fso.BuildPath(dest, f.Name)
  On Error Resume Next
  fso.CopyFile f.Path, destFile, True
  On Error Goto 0
Next

Set subfolders = srcFolder.SubFolders
For Each s In subfolders
  If Not isExcluded(s.Name) Then
    destSub = fso.BuildPath(dest, s.Name)
    On Error Resume Next
    If Not fso.FolderExists(destSub) Then fso.CreateFolder(destSub)
    fso.CopyFolder s.Path & "\", destSub & "\", True
    On Error Goto 0
  End If
Next

objShell.Popup "Publicación completada desde: " & src & vbCrLf & "-> " & dest, 3, "publish_dev", 64

 ' After copying, ask whether to create a full package
 createPkg = MsgBox("¿Crear Paquete completo (ejecutable) ahora?" & vbCrLf & "Yes = Crear paquete. No = Sólo copiar.", vbYesNoCancel + 32, "publish_dev - Crear paquete")
 If createPkg = vbCancel Then
   WScript.Quit 0
 ElseIf createPkg = vbYes Then
   ' Determine package version from dest\package.json if present
   pkgPath = fso.BuildPath(dest, "package.json")
   currentVer = "0.0.0"
   If fso.FileExists(pkgPath) Then
     Set pf = fso.OpenTextFile(pkgPath, 1)
     pkgText = pf.ReadAll
     pf.Close
     pos = Instr(pkgText, """version""")
     If pos > 0 Then
       posColon = Instr(pos, pkgText, ":")
      posQ1 = Instr(posColon, pkgText, Chr(34))
      posQ2 = Instr(posQ1+1, pkgText, Chr(34))
       If posQ1 > 0 And posQ2 > posQ1 Then
         currentVer = Mid(pkgText, posQ1+1, posQ2-posQ1-1)
       End If
     End If
   End If
   newVer = InputBox("Versión para el paquete (ej. 0.1.0):", "publish_dev - Versión", currentVer)
   If newVer = "" Then
     objShell.Popup "No se indicó versión. Cancelando empaquetado.", 5, "publish_dev", 48
     WScript.Quit 0
   End If
   ' Update package.json if present
   If fso.FileExists(pkgPath) Then
     newPkgText = Replace(pkgText, """version"":" & Chr(34) & currentVer & Chr(34), """version"":" & Chr(34) & newVer & Chr(34))
     Set pfw = fso.OpenTextFile(pkgPath, 2)
     pfw.Write newPkgText
     pfw.Close
   End If

   ' Run npm install and packaging in destination
   cmd = "cmd /c cd /d """ & dest & """ && npm install --no-audit --no-fund && npm run package-win"
   ret = objShell.Run(cmd, 1, True)

   ' After packaging, move dist to RELEASE
   distPath = fso.BuildPath(dest, "dist")
   releasePath = fso.BuildPath(dest, "RELEASE")
   If fso.FolderExists(distPath) Then
     If fso.FolderExists(releasePath) Then
       On Error Resume Next
       fso.DeleteFolder releasePath, True
       On Error Goto 0
     End If
     On Error Resume Next
     fso.MoveFolder distPath, releasePath
     On Error Goto 0
     objShell.Popup "Empaquetado finalizado. Resultado en: " & releasePath, 5, "publish_dev", 64
   Else
     objShell.Popup "No se encontró la carpeta 'dist' tras el empaquetado. Comprueba la salida de npm.", 10, "publish_dev", 48
   End If
End If
