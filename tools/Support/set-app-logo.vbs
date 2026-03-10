' set-app-logo.vbs
' Selecciona un sprite (archivo) y lo copia como logo de la app
' Coloca la imagen en electron\assets\app-icon.png
' Uso: doble clic sobre este archivo desde el Explorador o ejecutarlo con cscript/wscript

Option Explicit
Dim fso, sh, sel, filePath, scriptFull, scriptFolder, repoRoot, destDir, destFile, msg
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("Shell.Application")
On Error Resume Next
' Intentar dialogo de selección (con BIF_BROWSEINCLUDEFILES) — en algunos Windows permite elegir archivos
Set sel = sh.BrowseForFolder(0, "Selecciona el sprite (archivo) o una carpeta. Si no funciona, pega la ruta en la siguiente entrada:", &H4000, 0)
If Not sel Is Nothing Then
  filePath = sel.Self.Path
End If
If IsEmpty(filePath) Or filePath = "" Or Not fso.FileExists(filePath) Then
  filePath = InputBox("Introduce la ruta completa al archivo de sprite (PNG/JPG):", "Ruta sprite")
  If filePath = "" Then WScript.Quit
  If Not fso.FileExists(filePath) Then
    MsgBox "Archivo no encontrado: " & filePath, vbExclamation, "Error"
    WScript.Quit
  End If
End If
' Calcular ruta del repo (dos niveles sobre tools\Support)
scriptFull = WScript.ScriptFullName
scriptFolder = fso.GetParentFolderName(scriptFull)
repoRoot = fso.GetParentFolderName(scriptFolder) ' tools
repoRoot = fso.GetParentFolderName(repoRoot)    ' repo root
destDir = repoRoot & "\electron\assets"
If Not fso.FolderExists(destDir) Then
  On Error Resume Next
  If Not fso.FolderExists(repoRoot & "\electron") Then fso.CreateFolder(repoRoot & "\electron")
  fso.CreateFolder(destDir)
  On Error GoTo 0
End If
destFile = destDir & "\app-icon.png"
On Error Resume Next
fso.CopyFile filePath, destFile, True
If Err.Number <> 0 Then
  MsgBox "Error copiando archivo: " & Err.Description, vbCritical, "Error"
  WScript.Quit
End If
msg = "Logo aplicado: " & destFile & vbCrLf & "Reinicia la aplicación (o vuelve a crear la ventana) para ver el cambio."
MsgBox msg, vbInformation, "Hecho"
