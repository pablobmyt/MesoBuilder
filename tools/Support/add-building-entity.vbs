Option Explicit

Dim shell, fso
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

Dim scriptFolder, projectRoot
' El script está en tools\Support\ → subir 2 niveles = raíz del proyecto
scriptFolder = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetParentFolderName(fso.GetParentFolderName(scriptFolder))

Dim defsPath, pixelsPath
defsPath = fso.BuildPath(projectRoot, "data\entities-defs.json")
pixelsPath = fso.BuildPath(projectRoot, "data\entity-pixels.json")

If Not fso.FileExists(defsPath) Or Not fso.FileExists(pixelsPath) Then
  shell.Popup "No se encontraron los JSON del proyecto en: " & projectRoot, 6, "Add Building Entity", 48
  WScript.Quit 1
End If

Dim entityId, displayName, sizeW, sizeH, costBrick, costWheat, prodPop, roofColor, wallColor, spriteGrid
entityId = Trim(InputBox("ID interno de la entidad (ej: mesopotamian_villa_detailed)", "Add Building Entity", "new_building"))
If entityId = "" Then WScript.Quit 0

displayName = Trim(InputBox("Nombre visible", "Add Building Entity", "Nueva construcción"))
If displayName = "" Then displayName = entityId

sizeW = AskNumber("Ancho en celdas", "2")
sizeH = AskNumber("Alto en celdas", "2")
costBrick = AskNumber("Coste de ladrillo", "10")
costWheat = AskNumber("Coste de trigo", "2")
prodPop = AskNumber("Población que aporta", "4")
roofColor = AskText("Color del tejado (hex)", "#8B6914")
wallColor = AskText("Color principal/pared (hex)", "#C8A84B")
spriteGrid = AskNumber("Grid del sprite", "9")

BackupFile defsPath
BackupFile pixelsPath

Dim defsStatus, pixelsStatus
defsStatus = InsertEntryInObject(defsPath, "buildings", MakeBuildingEntry(entityId, displayName, sizeW, sizeH, costBrick, costWheat, prodPop, wallColor, roofColor))
pixelsStatus = InsertEntryInObject(pixelsPath, "icons", MakeIconEntry(entityId, spriteGrid, roofColor, wallColor))

shell.Popup "Proceso completado." & vbCrLf & vbCrLf & _
  "entities-defs.json: " & defsStatus & vbCrLf & _
  "entity-pixels.json: " & pixelsStatus & vbCrLf & vbCrLf & _
  "Ahora añade el botón al panel o usa la entidad desde código si hace falta.", 8, "Add Building Entity", 64


Function AskText(prompt, defaultValue)
  Dim value
  value = Trim(InputBox(prompt, "Add Building Entity", defaultValue))
  If value = "" Then value = defaultValue
  AskText = value
End Function

Function AskNumber(prompt, defaultValue)
  Dim value
  value = Trim(InputBox(prompt, "Add Building Entity", defaultValue))
  If value = "" Then value = defaultValue
  AskNumber = CLng(value)
End Function

Sub BackupFile(path)
  On Error Resume Next
  Dim bakPath
  bakPath = path & ".bak"
  fso.CopyFile path, bakPath, True
  On Error GoTo 0
End Sub

Function ReadAll(path)
  Dim ts
  Set ts = fso.OpenTextFile(path, 1, False, -1)
  ReadAll = ts.ReadAll
  ts.Close
End Function

Sub WriteAll(path, content)
  Dim ts
  Set ts = fso.OpenTextFile(path, 2, True, -1)
  ts.Write content
  ts.Close
End Sub

Function EscapeJson(value)
  Dim s
  s = CStr(value)
  s = Replace(s, "\", "\\")
  s = Replace(s, Chr(34), "\" & Chr(34))
  EscapeJson = s
End Function

Function FindMatchingBrace(text, openPos)
  Dim i, ch, depth, inString, escaping
  depth = 0
  inString = False
  escaping = False
  For i = openPos To Len(text)
    ch = Mid(text, i, 1)
    If inString Then
      If escaping Then
        escaping = False
      ElseIf ch = "\" Then
        escaping = True
      ElseIf ch = Chr(34) Then
        inString = False
      End If
    Else
      If ch = Chr(34) Then
        inString = True
      ElseIf ch = "{" Then
        depth = depth + 1
      ElseIf ch = "}" Then
        depth = depth - 1
        If depth = 0 Then
          FindMatchingBrace = i
          Exit Function
        End If
      End If
    End If
  Next
  FindMatchingBrace = 0
End Function

Function InsertEntryInObject(filePath, objectKey, entryText)
  Dim text, token, keyPos, openPos, closePos, beforeClose, afterClose, trimmed, lastChar, insertText
  text = ReadAll(filePath)
  token = Chr(34) & objectKey & Chr(34) & ":"
  If InStr(1, text, Chr(34) & GetEntryName(entryText) & Chr(34) & ":", vbTextCompare) > 0 Then
    InsertEntryInObject = "ya existía"
    Exit Function
  End If
  keyPos = InStr(1, text, token, vbTextCompare)
  If keyPos = 0 Then
    InsertEntryInObject = "objeto no encontrado"
    Exit Function
  End If
  openPos = InStr(keyPos, text, "{")
  closePos = FindMatchingBrace(text, openPos)
  If openPos = 0 Or closePos = 0 Then
    InsertEntryInObject = "no se pudo localizar el bloque JSON"
    Exit Function
  End If

  beforeClose = Left(text, closePos - 1)
  afterClose = Mid(text, closePos)
  trimmed = RTrim(beforeClose)
  lastChar = Right(trimmed, 1)
  If lastChar = "{" Then
    insertText = vbCrLf & entryText & vbCrLf & "  "
  Else
    insertText = "," & vbCrLf & entryText & vbCrLf & "  "
  End If

  WriteAll filePath, beforeClose & insertText & afterClose
  InsertEntryInObject = "añadido"
End Function

Function GetEntryName(entryText)
  Dim p1, p2
  p1 = InStr(1, entryText, Chr(34))
  p2 = InStr(p1 + 1, entryText, Chr(34))
  If p1 > 0 And p2 > p1 Then
    GetEntryName = Mid(entryText, p1 + 1, p2 - p1 - 1)
  Else
    GetEntryName = ""
  End If
End Function

Function MakeBuildingEntry(entityId, displayName, sizeW, sizeH, costBrick, costWheat, prodPop, wallColor, roofColor)
  Dim s
  s = "    " & Chr(34) & EscapeJson(entityId) & Chr(34) & ": { " & _
      Chr(34) & "name" & Chr(34) & ": " & Chr(34) & EscapeJson(displayName) & Chr(34) & ", " & _
      Chr(34) & "costBrick" & Chr(34) & ": " & costBrick & ", " & _
      Chr(34) & "costWheat" & Chr(34) & ": " & costWheat & ", " & _
      Chr(34) & "prodPop" & Chr(34) & ": " & prodPop & ", " & _
      Chr(34) & "prodWheat" & Chr(34) & ": 0, " & _
      Chr(34) & "prodBrick" & Chr(34) & ": 0, " & _
      Chr(34) & "color" & Chr(34) & ": " & Chr(34) & EscapeJson(wallColor) & Chr(34) & ", " & _
      Chr(34) & "roofColor" & Chr(34) & ": " & Chr(34) & EscapeJson(roofColor) & Chr(34) & ", " & _
      Chr(34) & "desc" & Chr(34) & ": " & Chr(34) & "Añadida con add-building-entity.vbs" & Chr(34) & ", " & _
      Chr(34) & "size" & Chr(34) & ": { " & Chr(34) & "w" & Chr(34) & ": " & sizeW & ", " & Chr(34) & "h" & Chr(34) & ": " & sizeH & " } }"
  MakeBuildingEntry = s
End Function

Function MakeIconEntry(entityId, spriteGrid, roofColor, wallColor)
  Dim s
  s = "    " & Chr(34) & EscapeJson(entityId) & Chr(34) & ": {" & vbCrLf & _
      "      " & Chr(34) & "grid" & Chr(34) & ": " & spriteGrid & "," & vbCrLf & _
      "      " & Chr(34) & "pixels" & Chr(34) & ": [" & vbCrLf & _
      "        [4,0," & Chr(34) & EscapeJson(roofColor) & Chr(34) & "],[3,1," & Chr(34) & EscapeJson(roofColor) & Chr(34) & "],[4,1," & Chr(34) & EscapeJson(roofColor) & Chr(34) & "],[5,1," & Chr(34) & EscapeJson(roofColor) & Chr(34) & "]," & vbCrLf & _
      "        [2,2," & Chr(34) & EscapeJson(roofColor) & Chr(34) & "],[3,2," & Chr(34) & EscapeJson(roofColor) & Chr(34) & "],[4,2," & Chr(34) & EscapeJson(roofColor) & Chr(34) & "],[5,2," & Chr(34) & EscapeJson(roofColor) & Chr(34) & "],[6,2," & Chr(34) & EscapeJson(roofColor) & Chr(34) & "]," & vbCrLf & _
      "        [2,3," & Chr(34) & EscapeJson(wallColor) & Chr(34) & "],[3,3," & Chr(34) & EscapeJson(wallColor) & Chr(34) & "],[4,3," & Chr(34) & EscapeJson(wallColor) & Chr(34) & "],[5,3," & Chr(34) & EscapeJson(wallColor) & Chr(34) & "],[6,3," & Chr(34) & EscapeJson(wallColor) & Chr(34) & "]," & vbCrLf & _
      "        [2,4," & Chr(34) & EscapeJson(wallColor) & Chr(34) & "],[3,4," & Chr(34) & "#E8D5A3" & Chr(34) & "],[4,4," & Chr(34) & "#4A3728" & Chr(34) & "],[5,4," & Chr(34) & "#E8D5A3" & Chr(34) & "],[6,4," & Chr(34) & EscapeJson(wallColor) & Chr(34) & "]," & vbCrLf & _
      "        [2,5," & Chr(34) & EscapeJson(wallColor) & Chr(34) & "],[3,5," & Chr(34) & EscapeJson(wallColor) & Chr(34) & "],[4,5," & Chr(34) & EscapeJson(wallColor) & Chr(34) & "],[5,5," & Chr(34) & EscapeJson(wallColor) & Chr(34) & "],[6,5," & Chr(34) & EscapeJson(wallColor) & Chr(34) & "]" & vbCrLf & _
      "      ]" & vbCrLf & _
      "    }"
  MakeIconEntry = s
End Function
