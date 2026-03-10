Set objShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Determine script folder and project root (assume this .vbs is in bin\)
scriptFull = WScript.ScriptFullName
scriptFolder = fso.GetParentFolderName(scriptFull)
projectRoot = fso.GetParentFolderName(scriptFolder)

' Candidate index paths: projectRoot\index.html, scriptFolder\index.html
indexPath = fso.BuildPath(projectRoot, "index.html")
If Not fso.FileExists(indexPath) Then
	indexPath = fso.BuildPath(scriptFolder, "index.html")
End If

If fso.FileExists(indexPath) Then
	' Instead of launching the game, render sprites defined in data/entity-pixels.json
	entityPath = fso.BuildPath(projectRoot, "data\entity-pixels.json")
	If Not fso.FileExists(entityPath) Then
		Msg = "No se encontró data\entity-pixels.json en: " & projectRoot
		objShell.Popup Msg, 6, "MesoBuilder - Error", 48
	Else
		Set entFile = fso.OpenTextFile(entityPath, 1)
		jsonText = entFile.ReadAll
		entFile.Close

		' Create an HTML page that renders the sprites into canvases and offers downloads
		rendererPath = fso.BuildPath(scriptFolder, "render_sprites.html")
		Set out = fso.CreateTextFile(rendererPath, True)
		out.WriteLine "<!doctype html>"
		out.WriteLine "<html><head><meta charset='utf-8'><title>MesoBuilder - Sprite Renderer</title>"
		out.WriteLine "<style>body{font-family:segui UI,Arial;margin:16px;background:#f6f6f6;color:#111}#container{display:flex;flex-wrap:wrap;gap:16px} .icon{background:#fff;border:1px solid #ddd;padding:8px;border-radius:6px;width:calc(200px);box-shadow:0 1px 2px rgba(0,0,0,0.06)} .icon canvas{display:block;margin:6px 0;background:transparent} .icon .title{font-weight:600;font-size:0.95rem}</style>"
		out.WriteLine "</head><body>"
		out.WriteLine "<h1>MesoBuilder — Sprite Renderer</h1>"
		out.WriteLine "<p>Se generan los sprites a partir de <code>data/entity-pixels.json</code>. Haz click en " & Chr(34) & "Download" & Chr(34) & " para guardar cada PNG.</p>"
		out.WriteLine "<div id='container'></div>"
		out.WriteLine "<script id='sprite-data' type='application/json'>"
		out.WriteLine jsonText
		out.WriteLine "</script>"
		out.WriteLine "<script>"
		out.WriteLine "(function(){const dataEl=document.getElementById('sprite-data');let data={};try{data=JSON.parse(dataEl.textContent)}catch(e){document.body.innerHTML='<h2>Error parsing JSON</h2><pre>'+e+'</pre>';return;}const container=document.getElementById('container');const pixelSize=8;for(const key in data.icons){const def=data.icons[key];let maxX=0,maxY=0;def.pixels.forEach(function(p){if(p[0]>maxX)maxX=p[0];if(p[1]>maxY)maxY=p[1];});const canvas=document.createElement('canvas');canvas.width=(maxX+1)*pixelSize;canvas.height=(maxY+1)*pixelSize;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;def.pixels.forEach(function(p){ctx.fillStyle=p[2];ctx.fillRect(p[0]*pixelSize,p[1]*pixelSize,pixelSize,pixelSize)});const wrap=document.createElement('div');wrap.className='icon';const title=document.createElement('div');title.className='title';title.textContent=key;const dl=document.createElement('a');dl.href=canvas.toDataURL();dl.download=key+'.png';dl.textContent='Download';wrap.appendChild(title);wrap.appendChild(canvas);wrap.appendChild(dl);container.appendChild(wrap);} })();</script>"
		out.WriteLine "</body></html>"
		out.Close

		' Open the renderer in the default browser
		objShell.Run Chr(34) & rendererPath & Chr(34), 1, False
	End If
Else
	Msg = "No se encontró index.html en: " & projectRoot & " ni en: " & scriptFolder & vbCrLf & "Abre el proyecto desde la carpeta correcta."
	objShell.Popup Msg, 6, "MesoBuilder - Error", 48
End If
