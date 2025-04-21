#target photoshop
/*
// BEGIN__HARVEST_EXCEPTION_ZSTRING
<javascriptresource> 
<name>SD helper</name> 
<eventid>338cc304-fb6f-4b1f-8ad4-13bbd65f117c</eventid>
<terminology><![CDATA[<< /Version 1
                        /Events <<
                        /338cc304-fb6f-4b1f-8ad4-13bbd65f117c [(SD helper) <<
                        /inpaintMode [(Inpaint mode) /boolean] 
                        >>]
                         >>
                      >> ]]></terminology>
</javascriptresource>
// END__HARVEST_EXCEPTION_ZSTRING
*/
const SD_HOST = '127.0.0.1',
    SD_PORT = 7860,
    API_HOST = '127.0.0.1',
    API_PORT_SEND = 6320,
    API_PORT_LISTEN = 6321,
    API_FILE = 'sd-webui-api v2.pyw',
    LAYER_NAME = 'SD generated image',
    UUID = '338cc304-fb6f-4b1f-8ad4-13bbd65f117c',
    SD_GET_OPTIONS_DELAY = 2500, // максимальное время ожидания ответа Stable Diffusion при запросе текущих параметров
    SD_RELOAD_CHECKPOINT_DELAY = 10000, // максимальное время ожидания перезагрузки checkpoint или vae
    SD_GENERATION_DELAY = 60000; // максимальное время ожидания генерации изображения
var time = (new Date).getTime(),
    SD = new SDApi(SD_HOST, API_HOST, SD_PORT, API_PORT_SEND, API_PORT_LISTEN, new File((new File($.fileName)).path + '/' + API_FILE)),
    s2t = stringIDToTypeID,
    t2s = typeIDToStringID,
    cfg = new Config(),
    str = new Locale(),
    apl = new AM('application'),
    doc = new AM('document'),
    lr = new AM('layer'),
    ch = new AM('channel'),
    ver = 0.26,
    isDitry = false;
isCancelled = false;
$.localize = true
if (ScriptUI.environment.keyboardState.shiftKey) $.setenv('dialogMode', true)
try { init() } catch (e) {
    SD.exit()
    alert(e)
    isCancelled = true;
}
isCancelled ? 'cancel' : undefined
function init() {
    var currentSelection = { result: false, bounds: null, previousGeneration: null, junk: null };
    if (apl.getProperty('numberOfDocuments')) activeDocument.suspendHistory('Check selection', 'checkSelection(currentSelection)');
    if (currentSelection.result) {
        var b = currentSelection.bounds,
            w = Math.floor((b.right - b.left) / 8) * 8,
            h = Math.floor((b.bottom - b.top) / 8) * 8;
        if (w != (b.right - b.left) || h != (b.bottom - b.top)) {
            b.bottom = b.top + h;
            b.right = b.left + w;
        }
        b.width = b.right - b.left
        b.height = b.bottom - b.top
        if (!app.playbackParameters.count || app.playbackParameters.count == 1) {
            cfg.getScriptSettings();
            if (app.playbackParameters.count == 1) $.setenv('dialogMode', true)
            if (($.getenv('dialogMode') == 'true' || $.getenv('dialogMode') == null)) {
                if (SD.initialize()) {
                    var w = dialogWindow(currentSelection.bounds, (((new Date).getTime() - time) / 1000)); var result = w.show()
                    $.setenv('dialogMode', false)
                    if (result == 2) {
                        SD.exit()
                        isCancelled = true;
                        return;
                    } else if (result != undefined) {
                        doForcedProgress(str.progressGenerate[$.locale == 'ru' ? 'ru' : 'en'], 'main(currentSelection)')
                        cfg.putScriptSettings()
                        cfg.putScriptSettings(true, true)
                        SD.exit()
                    }
                }
            } else {
                if (SD.initialize()) {
                    $.setenv('dialogMode', false)
                    doForcedProgress(str.progressGenerate[$.locale == 'ru' ? 'ru' : 'en'], 'main(currentSelection)')
                    cfg.putScriptSettings(true)
                    SD.exit()
                } else {
                    if (cleanup && targetID) doc.deleteLayer(targetID)
                    SD.exit()
                    isCancelled = true
                }
            }
        }
        else {
            cfg.getScriptSettings(true)
            if (!cfg.current.recordToAction) {
                cfg.getScriptSettings()
                cfg.current.recordToAction = false
            }
            if (app.playbackDisplayDialogs == DialogModes.ALL) {
                if (SD.initialize()) {
                    var w = dialogWindow(currentSelection.bounds, (((new Date).getTime() - time) / 1000)); var result = w.show()
                    if (result == 2) {
                        SD.exit()
                        isCancelled = true;
                        return;
                    } else if (result != undefined) {
                        doForcedProgress(str.progressGenerate[$.locale == 'ru' ? 'ru' : 'en'], 'main(currentSelection)')
                        if (cfg.current.recordToAction) cfg.putScriptSettings(true) else cfg.putScriptSettings()
                        SD.exit()
                    }
                }
            } else {
                if (SD.initialize()) { doForcedProgress(str.progressGenerate[$.locale == 'ru' ? 'ru' : 'en'], 'main(currentSelection)') }
                SD.exit()
            }
        }
    }
}
function main(selection) {
    var checkpoint = (cfg.current.sd_model_checkpoint == SD['sd_model_checkpoint'] ? null : findOption(cfg.current.sd_model_checkpoint, SD['sd-models'], SD['sd_model_checkpoint'])),
        vae = (cfg.current.sd_vae == SD['sd_vae'] ? null : findOption(cfg.current.sd_vae, SD['sd-vaes'], SD['sd_vae']));
    if (vae != cfg.current.sd_vae && vae != null) cfg.current.sd_vae = vae
    if (checkpoint != cfg.current.sd_model_checkpoint && checkpoint != null) cfg.current.sd_model_checkpoint = checkpoint
    if (selection.previousGeneration) doc.hideSelectedLayers()
    if (doc.getProperty('quickMask')) {
        doc.quickMask('clearEvent');
        doc.makeLayer(LAYER_NAME)
        doc.makeSelectionMask()
    } else if (doc.hasProperty('selection')) {
        doc.makeLayer(LAYER_NAME)
        doc.makeSelectionMask()
    } else if (lr.getProperty('name') == LAYER_NAME) {
        if (lr.getProperty('hasUserMask')) {
            lr.selectChannel('mask')
            doc.makeSelectionFromLayer('targetEnum');
        } else {
            doc.makeSelectionFromLayer('transparencyEnum');
            doc.makeSelectionMask()
        }
    }
    selection.junk = lr.getProperty('layerID')
    doc.makeSelection(selection.bounds);
    var hst = activeDocument.activeHistoryState,
        c = doc.getProperty('center').value;
    doc.crop(true);
    if (cfg.current.flatten) { doc.flatten() } else {
        var len = doc.getProperty('numberOfLayers'),
            start = lr.getProperty('itemIndex'),
            lrsList = new ActionReference();
        offset = doc.getProperty('hasBackgroundLayer') ? 0 : 1;
        for (var i = start + offset; i <= len; i++) lrsList.putIdentifier(s2t('layer'), lr.getProperty('layerID', false, i, true));
        if (start + offset <= len) {
            doc.selectLayersByIDList(lrsList);
            doc.hideSelectedLayers();
        }
    }
    var f = new File(Folder.temp + '/SDH.jpg');
    var f1 = new File(Folder.temp + '/SDH_MASK.jpg');
    doc.saveACopy(f);
    if (cfg.inpaintMode) {
        lr.selectChannel('mask');
        lr.selectAllPixels();
        doc.copyPixels()
        lr.selectChannel('RGB')
        doc.pastePixels()
        doc.saveACopy(f1);
    }
    activeDocument.activeHistoryState = hst;
    doc.setProperty('center', c);
    var p = (new Folder(Folder.temp + '/' + SD['outdir_img2img_samples']))
    if (!p.exists) p.create()
    if (checkpoint || vae) {
        var vae_path = [];
        if (SD.forgeUI) {
            for (var i = 0; i < SD['forge_additional_modules'].length; i++) {
                if (SD['forge_additional_modules'][i].indexOf(cfg.current.sd_vae) != -1) {
                    vae_path.push(SD['forge_additional_modules'][i])
                    break;
                }
            }
        }
        changeProgressText(str.progressUpdating[$.locale == 'ru' ? 'ru' : 'en'])
        updateProgress(0.1, 1)
        if (!SD.setOptions(checkpoint, vae, vae_path)) throw new Error(str.errUpdating)
    }
    changeProgressText(str.progressDocument[$.locale == 'ru' ? 'ru' : 'en'])
    updateProgress(0.2, 1)
    if (cfg.current.autoResize && !isDitry) cfg.current.resize = autoScale(selection.bounds)
    var width = cfg.current.resize != 1 ? (mathTrunc((selection.bounds.width * cfg.current.resize) / 8) * 8) : selection.bounds.width,
        height = cfg.current.resize != 1 ? (mathTrunc((selection.bounds.height * cfg.current.resize) / 8) * 8) : selection.bounds.height
    var payload = {
        'input': f.fsName.replace(/\\/g, '\\\\'),
        'output': p.fsName.replace(/\\/g, '\\\\'),
        'prompt': cfg.current.prompt,
        'negative_prompt': cfg.current.negative_prompt,
        'sampler_name': cfg.current.sampler_name,
        'scheduler': cfg.current.scheduler,
        'cfg_scale': cfg.current.cfg_scale,
        'seed': -1,
        'steps': cfg.current.steps,
        'width': width,
        'height': height,
        'denoising_strength': cfg.current.denoising_strength,
        'n_iter': 1,
    };
    if (cfg.inpaintMode) {
        payload['mask'] = f1.fsName.replace(/\\/g, '\\\\')
        payload['inpainting_fill'] = cfg.current.inpaintingFill
    }
    updateProgress(0.3, 1)
    changeProgressText(str.progressGenerate[$.locale == 'ru' ? 'ru' : 'en'])
    app.refresh()
    var result = SD.sendPayload(payload);
    if (result) {
        activeDocument.suspendHistory('Generate image', 'generatedImageToLayer()')
    } else throw new Error(str.errGenerating)
    function generatedImageToLayer() {
        updateProgress(1, 1)
        changeProgressText(str.progressPlace[$.locale == 'ru' ? 'ru' : 'en'])
        doc.place(new File(result))
        var placedBounds = doc.descToObject(lr.getProperty('bounds').value);
        var dW = (selection.bounds.right - selection.bounds.left) / (placedBounds.right - placedBounds.left);
        var dH = (selection.bounds.bottom - selection.bounds.top) / (placedBounds.bottom - placedBounds.top)
        lr.transform(dW * 100, dH * 100);
        if (cfg.current.rasterizeImage) { try { lr.rasterize() } catch (e) { } }
        lr.setName(LAYER_NAME)
        doc.makeSelectionFromLayer('mask', selection.junk)
        doc.makeSelectionMask()
        doc.deleteLayer(selection.junk)
        lr.selectChannel('mask');
        if (cfg.current.selectBrush) {
            doc.resetSwatches()
            doc.selectBrush();
            doc.setBrushOpacity(cfg.current.brushOpacity)
        }
        (new File(result)).remove();
    }
    function findOption(s, o, def) {
        for (a in o) if (o[a] == s) return s;
        return def;
    }
}
function dialogWindow(b, s) {
    var w = new Window("dialog{orientation:'column',alignChildren:['fill', 'top'],spacing:10,margins:16}"),
        grGlobal = w.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:0,margins:0}"),
        stWH = grGlobal.add("statictext{preferredSize:[130,-1]}"),
        rbImg = grGlobal.add("radiobutton{preferredSize:[65,-1]}"),
        rbInpaint = grGlobal.add("radiobutton{preferredSize:[65,-1]}"),
        bnSettings = grGlobal.add("button{preferredSize:[25, 25]}"),
        grSettings = w.add("group{orientation:'column',alignChildren:['fill', 'left'],spacing:5,margins:0}");
    showControls(grSettings);
    var grOk = w.add("group{orientation:'row',alignChildren:['center', 'center'],spacing:10,margins:[0, 10, 0, 0]}"),
        Ok = grOk.add('button', undefined, undefined, { name: 'ok' });
    w.text = 'SD Helper v.' + ver + ' - responce time ' + s + 's';
    stWH.text = str.selection + b.width + 'x' + b.height;
    rbImg.text = 'Img2Img'
    rbInpaint.text = 'Inpaint'
    bnSettings.text = '⚙';
    Ok.text = str.generate;
    bnSettings.helpTip = str.settings
    cfg.inpaintMode ? (rbInpaint.value = true) : (rbImg.value = true);
    bnSettings.onClick = function () {
        var tempSettings = {}
        cloneObject(cfg.current, tempSettings)
        var s = settingsWindow(w, tempSettings),
            result = s.show();
        if (result == 1) {
            var changed = false;
            for (var a in tempSettings) {
                if (a.indexOf('show') == -1 && a.indexOf('autoResize') == -1) continue;
                if (tempSettings[a] != cfg.current[a]) {
                    changed = true
                    break;
                }
            }
            cloneObject(tempSettings, cfg.current)
            if (changed) {
                showControls(grSettings)
                w.layout.layout(true)
            }
        }
    }
    rbImg.onClick = function () {
        cfg.inpaint = cfg.current
        cfg.current = cfg.img2img
        cfg.inpaintMode = false
        showControls(grSettings)
        w.layout.layout(true)
    }
    rbInpaint.onClick = function () {
        cfg.img2img = cfg.current
        cfg.current = cfg.inpaint
        cfg.inpaintMode = true
        showControls(grSettings)
        w.layout.layout(true)
    }
    return w;
    function showControls(p) {
        var len = p.children.length
        for (var i = 0; i < len; i++) {
            p.remove(p.children[0])
        }
        if (cfg.current.showInpaintingFill && cfg.inpaintMode) inpaintingFill(p)
        if (cfg.current.showSd_model_checkpoint) checkpoint(p);
        if (cfg.current.showSd_vae) vae(p)
        if (cfg.current.showPrompt) prompt(p)
        if (cfg.current.showNegative_prompt) negativePrompt(p)
        if (cfg.current.showSampler_name) sampler(p)
        if (cfg.current.showScheduler) shelduler(p)
        if (cfg.current.showSteps) steps(p)
        if (cfg.current.showCfg_scale) cfgScale(p)
        if (cfg.current.showResize) resizeScale(p)
        denoisingStrength(p)
        function inpaintingFill(p) {
            var grCheckoint = p.add("group{orientation:'column',alignChildren:['fill', 'center'],spacing:0,margins:0}"),
                stCheckpoint = grCheckoint.add('statictext'),
                dlCheckpoint = grCheckoint.add('dropdownlist', undefined, undefined, { items: ['fill', 'original', 'latent noise', 'latent nothing'], preferredSize: [285, -1] });
            stCheckpoint.text = str.fill
            dlCheckpoint.selection = cfg.current.inpaintingFill
            dlCheckpoint.onChange = function () {
                cfg.current.inpaintingFill = this.selection.index
            }
        }
        function checkpoint(p) {
            var grCheckoint = p.add("group{orientation:'column',alignChildren:['fill', 'center'],spacing:0,margins:0}"),
                stCheckpoint = grCheckoint.add('statictext'),
                dlCheckpoint = grCheckoint.add('dropdownlist{preferredSize:[285,-1]}');
            stCheckpoint.text = str.checkpoint;
            if (SD['sd-models'].length) for (var i = 0; i < SD['sd-models'].length; i++) dlCheckpoint.add('item', SD['sd-models'][i])
            var current = dlCheckpoint.find(cfg.current.sd_model_checkpoint) ? dlCheckpoint.find(cfg.current.sd_model_checkpoint) : dlCheckpoint.find(SD['sd_model_checkpoint']);
            dlCheckpoint.selection = current ? current.index : 0
            dlCheckpoint.onChange = function () {
                cfg.current.sd_model_checkpoint = this.selection.text
            }
        }
        function vae(p) {
            var grVae = p.add("group{orientation:'column',alignChildren:['fill', 'center'],spacing:0,margins:0}"),
                stVae = grVae.add('statictext'),
                dlVae = grVae.add('dropdownlist{preferredSize:[285,-1]}')
            stVae.text = str.vae;
            if (SD['sd-vaes'].length) for (var i = 0; i < SD['sd-vaes'].length; i++) dlVae.add('item', SD['sd-vaes'][i])
            var current = dlVae.find(cfg.current.sd_vae) ? dlVae.find(cfg.current.sd_vae) : dlVae.find(SD['sd_vae']);
            dlVae.selection = current ? current.index : 0
            dlVae.onChange = function () {
                cfg.current.sd_vae = this.selection.text
            }
        }
        function prompt(p) {
            var grPrompt = p.add("group{orientation:'column',alignChildren:['fill', 'top'],spacing:0,margins:0}"),
                stPrompt = grPrompt.add('statictext'),
                etPrompt = grPrompt.add('edittext{preferredSize:[285,80],properties:{multiline: true, scrollable: true}}'),
                bnTranslate = grPrompt.add('button');
            stPrompt.text = str.prompt
            etPrompt.text = cfg.current.prompt
            bnTranslate.text = str.translate + 'ru -> en';
            bnTranslate.enabled = cfg.current.prompt.length
            etPrompt.onChange = function () {
                cfg.current.prompt = this.text
            }
            bnTranslate.onClick = function () {
                if (etPrompt.text != '') {
                    var result = SD.translate(etPrompt.text)
                    if (result) {
                        etPrompt.text = result
                        etPrompt.onChange()
                    } else {
                        alert(str.errTranslate)
                        this.enabled = false;
                        etPrompt.locked = true
                    }
                }
            }
            etPrompt.onChanging = function () {
                if (!this.locked) bnTranslate.enabled = this.text.length
            }
        }
        function negativePrompt(p) {
            var grNegative = p.add("group{orientation:'column',alignChildren:['fill', 'top'],spacing:0,margins:0}"),
                stNegative = grNegative.add('statictext'),
                etNegative = grNegative.add('edittext {preferredSize:[285,80],properties: {multiline: true, scrollable: true}}}'),
                bnTranslate = grNegative.add('button');
            stNegative.text = str.negativePrompt
            etNegative.text = cfg.current.negative_prompt;
            bnTranslate.text = str.translate + 'ru -> en';
            bnTranslate.enabled = cfg.current.negative_prompt.length
            etNegative.onChange = function () {
                cfg.current.negative_prompt = this.text
            }
            bnTranslate.onClick = function () {
                if (etNegative.text != '') {
                    var result = SD.translate(etNegative.text)
                    if (result) {
                        etNegative.text = result
                        etNegative.onChange()
                    } else {
                        alert(str.errTranslate)
                        this.enabled = false;
                        etNegative.locked = true
                    }
                }
            }
            etNegative.onChanging = function () {
                if (!this.locked) bnTranslate.enabled = this.text.length
            }
        }
        function sampler(p) {
            var grSampler = p.add("group{orientation:'column',alignChildren:['fill', 'center'],spacing:0,margins:0}"),
                stSampler = grSampler.add('statictext'),
                dlSampler = grSampler.add('dropdownlist{preferredSize:[285,-1]}');
            stSampler.text = str.sampling
            if (SD['samplers'].length) for (var i = 0; i < SD['samplers'].length; i++) dlSampler.add('item', SD['samplers'][i])
            var current = dlSampler.find(cfg.current.sampler_name);
            dlSampler.selection = current ? current.index : 0
            dlSampler.onChange = function () {
                cfg.current.sampler_name = this.selection.text
            }
        }
        function shelduler(p) {
            var grSheldue = p.add("group{orientation:'column',alignChildren:['fill', 'center'],spacing:0,margins:0}"),
                stSheldue = grSheldue.add('statictext'),
                dlSheldue = grSheldue.add('dropdownlist{preferredSize:[285,-1]}');
            stSheldue.text = str.schedule;
            if (SD['schedulers'].length) for (var i = 0; i < SD['schedulers'].length; i++) dlSheldue.add('item', SD['schedulers'][i])
            var current = dlSheldue.find(cfg.current.scheduler);
            dlSheldue.selection = current ? current.index : 0
            dlSheldue.onChange = function () {
                cfg.current.scheduler = this.selection.text
            }
        }
        function steps(p) {
            var grSteps = p.add("group{orientation:'column',alignChildren:['fill', 'top'],spacing:0,margins:0}"),
                grStepsTitle = grSteps.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:10,margins:0}"),
                stSteps = grStepsTitle.add('statictext{preferredSize:[220,-1]}'),
                stStepsValue = grStepsTitle.add('statictext{preferredSize:[65,-1],justify:"right"}'),
                slSteps = grSteps.add('slider{minvalue:1,maxvalue:100}');
            stSteps.text = str.steps
            slSteps.value = stStepsValue.text = cfg.current.steps
            slSteps.onChange = function () { stStepsValue.text = cfg.current.steps = mathTrunc(this.value) }
            slSteps.onChanging = function () { slSteps.onChange() }
            slSteps.addEventListener('keydown', commonHandler)
        }
        function cfgScale(p) {
            var grCfg = p.add("group{orientation:'column',alignChildren:['fill', 'top'],spacing:0,margins:0}"),
                grCfgTitle = grCfg.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:10,margins:0}"),
                stCfg = grCfgTitle.add('statictext{preferredSize:[220,-1]}'),
                stCfgValue = grCfgTitle.add('statictext{preferredSize:[65,-1],justify:"right"}'),
                slCfg = grCfg.add('slider{minvalue:2,maxvalue:30}');
            stCfg.text = str.cfgScale
            slCfg.value = cfg.current.cfg_scale * 2
            stCfgValue.text = cfg.current.cfg_scale
            slCfg.onChange = function () {
                stCfgValue.text = cfg.current.cfg_scale = mathTrunc(this.value) / 2
            }
            slCfg.onChanging = function () { slCfg.onChange() }
            slCfg.addEventListener('keydown', commonHandler)
        }
        function resizeScale(p) {
            var grResize = p.add("group{orientation:'column',alignChildren:['fill', 'top'],spacing:0,margins:0}"),
                grResizeTitle = grResize.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:10,margins:0}"),
                stResize = grResizeTitle.add('statictext{preferredSize:[220,-1]}'),
                stResizeValue = grResizeTitle.add('statictext{preferredSize:[65,-1],justify:"right"}'),
                slResize = grResize.add('slider{minvalue:1,maxvalue:40}');
            slResize.onChange = function () {
                stResizeValue.text = cfg.current.resize = mathTrunc(this.value) / 10
                stResizeValue.text = cfg.current.resize
                stResize.text = setTitle()
                isDitry = true
            }
            slResize.onChanging = function () { slResize.onChange() }
            slResize.addEventListener('keydown', commonHandler)
            if (cfg.current.autoResize) {
                cfg.current.resize = autoScale(b)
                slResize.value = cfg.current.resize * 10
                stResizeValue.text = cfg.current.resize
                stResize.text = setTitle()
            } else {
                slResize.value = cfg.current.resize * 10
                stResizeValue.text = cfg.current.resize = mathTrunc(slResize.value) / 10
                stResize.text = setTitle()
            }
            function setTitle() {
                var s = str.resize
                return cfg.current.resize != 1 ? s + ' ' + (mathTrunc((b.width * cfg.current.resize) / 8) * 8) + 'x' + (mathTrunc((b.height * cfg.current.resize) / 8) * 8) : s
            }
        }
        function denoisingStrength(p) {
            var grStrength = p.add("group{orientation:'column',alignChildren:['fill', 'top'],spacing:0,margins:0}"),
                grStrengthTitle = grStrength.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:10,margins:0}"),
                stStrength = grStrengthTitle.add('statictext{preferredSize:[220,-1]}'),
                stStrengthValue = grStrengthTitle.add('statictext{preferredSize:[65,-1],justify:"right"}'),
                slStrength = grStrength.add('slider{minvalue:0,maxvalue:100}');
            stStrength.text = str.strength
            slStrength.value = cfg.current.denoising_strength * 100
            stStrengthValue.text = cfg.current.denoising_strength
            slStrength.active = true
            slStrength.onChange = function () {
                stStrengthValue.text = cfg.current.denoising_strength = mathTrunc(this.value) / 100
            }
            slStrength.onChanging = function () { slStrength.onChange() }
            slStrength.addEventListener('keydown', commonHandler)
        }
    }
    function settingsWindow(p, cfg) {
        var w = new Window("dialog{orientation:'column',alignChildren:['fill', 'top'],spacing:10,margins:16}"),
            pnShow = w.add("panel{orientation:'column',alignChildren:['left', 'top'],spacing:0,margins:10}"),
            chInpaitnigFill = pnShow.add('checkbox'),
            chCheckpoint = pnShow.add('checkbox'),
            chVae = pnShow.add('checkbox'),
            chPrompt = pnShow.add('checkbox'),
            chNegative = pnShow.add('checkbox'),
            chSampling = pnShow.add('checkbox'),
            chSheldule = pnShow.add('checkbox'),
            chSteps = pnShow.add('checkbox'),
            chCfg = pnShow.add('checkbox'),
            chResize = pnShow.add('checkbox'),
            pnOutput = w.add("panel{orientation:'column',alignChildren:['fill', 'top'],spacing:5,margins:10}"),
            chFlatten = pnOutput.add('checkbox'),
            chRasterize = pnOutput.add('checkbox'),
            pnBrush = w.add("panel{orientation:'column',alignChildren:['fill', 'top'],spacing:10,margins:10}"),
            chSelectBrush = pnBrush.add('checkbox'),
            grOpacity = pnBrush.add("group{orientation:'column',alignChildren:['fill', 'center'],spacing:5,margins:0}"),
            grOpacityTitle = grOpacity.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:10,margins:0}"),
            stOpacityTitle = grOpacityTitle.add('statictext{preferredSize:[180,-1]}'),
            stOpacityValue = grOpacityTitle.add('statictext{preferredSize:[65,-1],justify:"right"}'),
            slOpacity = grOpacity.add('slider{minvalue:0,maxvalue:100}'),
            pnResize = w.add("panel{orientation:'column',alignChildren:['fill', 'top'],spacing:10,margins:10}"),
            chAutoResize = pnResize.add('checkbox'),
            grChResize = pnResize.add("group{orientation:'column',alignChildren:['fill', 'center'],spacing:10,margins:0}"),
            grResizeSl = grChResize.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:10,margins:0}"),
            grLess = grResizeSl.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:0,margins:0,preferredSize:[100,-1]}"),
            slLess = grLess.add('slider{minvalue:128,maxvalue:1024,preferredSize:[90,-1]}'),
            stLess = grLess.add('statictext{preferredSize:[30,-1],justify:"right"}'),
            grAbove = grResizeSl.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:0,margins:0,preferredSize:[100,-1]}"),
            slAbove = grAbove.add('slider{minvalue:1024,maxvalue:2048,preferredSize:[90,-1]}'),
            stAbove = grAbove.add('statictext{preferredSize:[30,-1],justify:"right"}'),
            chRecordSettings = w.add('checkbox'),
            grBn = w.add("group{orientation:'row',alignChildren:['center', 'center'],spacing:10,margins:[0, 10, 0, 0]}"),
            ok = grBn.add('button', undefined, undefined, { name: 'ok' });
        chAutoResize.text = str.autoResizeCaption
        chCfg.text = str.cfgScale;
        chCheckpoint.text = str.checkpoint
        chFlatten.text = str.flatten
        chInpaitnigFill.text = str.fill;
        chNegative.text = str.negativePrompt
        chPrompt.text = str.prompt
        chRasterize.text = str.rasterize
        chRecordSettings.text = str.actionMode
        chResize.text = str.resize
        chSampling.text = str.sampling
        chSelectBrush.text = str.selctBrush
        chSheldule.text = str.schedule
        chSteps.text = str.steps
        chVae.text = str.vae
        ok.text = str.apply
        pnBrush.text = str.brush
        pnOutput.text = str.output
        pnResize.text = str.autoResize
        pnShow.text = str.showItems
        slAbove.helpTip = str.max
        slLess.helpTip = str.min
        stOpacityTitle.text = str.opacity
        w.text = str.settings
        chAutoResize.value = grResizeSl.enabled = cfg.autoResize
        chCfg.value = cfg.showCfg_scale
        chCheckpoint.value = cfg.showSd_model_checkpoint
        chFlatten.value = cfg.flatten
        chInpaitnigFill.value = cfg.showInpaintingFill
        chNegative.value = cfg.showNegative_prompt
        chPrompt.value = cfg.showPrompt
        chRasterize.value = cfg.rasterizeImage
        chRecordSettings.value = !cfg.recordToAction
        chResize.value = cfg.showResize
        chSampling.value = cfg.showSampler_name
        chSelectBrush.value = cfg.selectBrush
        chSheldule.value = cfg.showScheduler
        chSteps.value = cfg.showSteps
        chVae.value = cfg.showSd_vae
        slAbove.value = stAbove.text = cfg.autoResizeAbove;
        slLess.value = stLess.text = cfg.autoResizeLess;
        slOpacity.value = stOpacityValue.text = cfg.brushOpacity
        chFlatten.onClick = function () { cfg.flatten = this.value }
        chRasterize.onClick = function () { cfg.rasterizeImage = this.value }
        chInpaitnigFill.onClick = function () { cfg.showInpaintingFill = this.value }
        chCheckpoint.onClick = function () { cfg.showSd_model_checkpoint = this.value }
        chVae.onClick = function () { cfg.showSd_vae = this.value }
        chPrompt.onClick = function () { cfg.showPrompt = this.value }
        chNegative.onClick = function () { cfg.showNegative_prompt = this.value }
        chSampling.onClick = function () { cfg.showSampler_name = this.value }
        chSheldule.onClick = function () { cfg.showScheduler = this.value }
        chSteps.onClick = function () { cfg.showSteps = this.value }
        chCfg.onClick = function () { cfg.showCfg_scale = this.value }
        chResize.onClick = function () { cfg.showResize = this.value }
        chSelectBrush.onClick = function () { cfg.selectBrush = this.value }
        slOpacity.onChange = function () { stOpacityValue.text = cfg.brushOpacity = mathTrunc(this.value) }
        slOpacity.onChanging = function () { slOpacity.onChange() }
        slOpacity.addEventListener('keydown', commonHandler)
        slLess.onChange = function () { stLess.text = cfg.autoResizeLess = mathTrunc(this.value / 32) * 32 }
        slLess.onChanging = function () { slLess.onChange() }
        slLess.addEventListener('keydown', resizeHandler)
        slAbove.onChange = function () { stAbove.text = cfg.autoResizeAbove = mathTrunc(this.value / 32) * 32 }
        slAbove.onChanging = function () { slAbove.onChange() }
        slAbove.addEventListener('keydown', resizeHandler)
        function resizeHandler(evt) {
            if (evt.shiftKey) {
                if (evt.keyIdentifier == 'Right' || evt.keyIdentifier == 'Up') {
                    evt.target.value = Math.floor(evt.target.value / 128) * 128 + 127
                } else if (evt.keyIdentifier == 'Left' || evt.keyIdentifier == 'Down') {
                    evt.target.value = Math.ceil(evt.target.value / 128) * 128 - 127
                }
            }
        }
        chAutoResize.onClick = function () { cfg.autoResize = grResizeSl.enabled = this.value; cfg.resize = 1; }
        chRecordSettings.onClick = function () { cfg.recordToAction = !this.value }
        return w
    }
    function commonHandler(evt) {
        if (evt.shiftKey) {
            if (evt.keyIdentifier == 'Right' || evt.keyIdentifier == 'Up') {
                evt.target.value = Math.floor(evt.target.value / 5) * 5 + 4
            } else if (evt.keyIdentifier == 'Left' || evt.keyIdentifier == 'Down') {
                evt.target.value = Math.ceil(evt.target.value / 5) * 5 - 4
            }
        }
    }
}
function mathTrunc(val) {
    return val < 0 ? Math.ceil(val) : Math.floor(val);
}
function autoScale(b) {
    var less = b.width < b.height ? b.width : b.height,
        above = b.width > b.height ? b.width : b.height,
        result = 0;
    if (less < cfg.current.autoResizeLess) result = Math.ceil(cfg.current.autoResizeLess / less * 1000) / 1000
    if (above > cfg.current.autoResizeAbove) result = Math.floor(cfg.current.autoResizeAbove / above * 1000) / 1000
    if (less >= cfg.current.autoResizeLess && above <= cfg.current.autoResizeAbove) result = 1
    return (result > 4 ? 4 : result)
}
function cloneObject(o1, o2) {
    var tmp = o1.reflect.properties;
    for (a in tmp) {
        var k = tmp[a].name.toString();
        if (k == '__proto__' || k == '__count__' || k == '__class__' || k == 'reflect') continue;
        o2[k] = o1[k]
    }
}
function checkSelection(result) {
    if (apl.getProperty('numberOfDocuments')) {
        if (doc.getProperty('quickMask')) {
            var selection = null;
            if (doc.hasProperty('selection')) selection = doc.descToObject(doc.getProperty('selection').value)
            doc.quickMask('clearEvent');
            var hasSelection = doc.hasProperty('selection')
            if (hasSelection) {
                result.result = true
                result.bounds = selection ? selection : doc.descToObject(doc.getProperty('selection').value)
            }
            doc.quickMask('set');
            if (selection) doc.makeSelection(selection)
            return
        } else {
            if (doc.hasProperty('selection')) {
                result.result = true
                result.bounds = doc.descToObject(doc.getProperty('selection').value)
                return
            }
            if (lr.getProperty('name') == LAYER_NAME) {
                doc.makeSelectionFromLayer('transparencyEnum')
                var hasSelection = doc.hasProperty('selection')
                if (hasSelection) {
                    result.result = true
                    result.bounds = doc.descToObject(doc.getProperty('selection').value)
                    result.previousGeneration = lr.getProperty('layerID')
                }
                doc.deselect()
                return
            }
        }
    }
    return
}
function findSDChannel(title) {
    var idx = 1;
    do {
        try { if (ch.getProperty('channelName', false, idx++, true) == title) return idx - 1 } catch (e) { return 0 }
    } while (true)
}
function SDApi(sdHost, apiHost, sdPort, portSend, portListen, apiFile) {
    this.forgeUI = false;
    var SdCfg = this;
    this.initialize = function () {
        if (!apiFile.exists)
            throw new Error(str.module + apiFile.fsName + str.notFound)
        if (!checkConnecton(sdHost + ':' + sdPort))
            throw new Error(str.errConnection + sdHost + ':' + sdPort + '\nStable Diffusion ' + str.errAnswer)
        apiFile.execute();
        var result = sendMessage({ type: 'handshake', message: { sdHost: sdHost, sdPort: sdPort } }, true);
        if (!result) throw new Error(str.errConnection + apiHost + ':' + portSend + '\n' + str.module + str.errAnswer)
        var result = sendMessage({ type: 'get', message: 'sdapi/v1/options' }, true);
        if (result) {
            SdCfg['outdir_img2img_samples'] = result['outdir_img2img_samples']
            SdCfg['sd_model_checkpoint'] = result['sd_model_checkpoint']
            SdCfg['sd_vae'] = result['sd_vae']
            if (result['forge_additional_modules']) SdCfg.forgeUI = true;
        } else { throw new Error(str.errSettings + 'sdapi/v1/options' + str.errTimeout) }
        var result = sendMessage({ type: 'get', message: 'sdapi/v1/sd-models' }, true);
        if (result) {
            SdCfg['sd-models'] = []
            if (!result.length) throw new Error(str.errList + 'sdapi/v1/sd-models' + str.errExists)
            for (var i = 0; i < result.length; i++) SdCfg['sd-models'].push(result[i].title)
        } else { throw new Error(str.errSettings + 'sdapi/v1/sd-models' + str.errTimeout) }
        var vaes = ['sdapi/v1/sd-vae', 'sdapi/v1/sd-modules']
        cfg.vae = (SdCfg.forgeUI ? vaes[1] : vaes[0])
        var result = sendMessage({ type: 'get', message: cfg.vae }, true);
        if (result) {
            SdCfg['sd-vaes'] = []
            SdCfg['sd-vaes'].push('Automatic')
            SdCfg['sd-vaes'].push('None')
            if (SdCfg.forgeUI) {
                SdCfg['forge_additional_modules'] = [];
                for (var i = 0; i < result.length; i++) SdCfg['forge_additional_modules'].push(result[i].filename.replace(/\\/g, '\\\\'))
            }
            for (var i = 0; i < result.length; i++) SdCfg['sd-vaes'].push(result[i].model_name)
        } else { throw new Error(str.errSettings + + cfg.vae + str.errTimeout) }
        var result = sendMessage({ type: 'get', message: 'sdapi/v1/schedulers' }, true);
        if (result) {
            SdCfg['schedulers'] = []
            if (!result.length) throw new Error(str.errList + 'sdapi/v1/schedulers' + str.errExists)
            for (var i = 0; i < result.length; i++) SdCfg['schedulers'].push(result[i].label)
        } else { throw new Error(str.errSettings + 'sdapi/v1/schedulers' + str.errTimeout) }
        var result = sendMessage({ type: 'get', message: 'sdapi/v1/samplers' }, true);
        if (result) {
            SdCfg['samplers'] = []
            if (!result.length) throw new Error(str.errList + 'sdapi/v1/samplers' + str.errExists)
            for (var i = 0; i < result.length; i++) SdCfg['samplers'].push(result[i].name)
        } else { throw new Error(str.errSettings + 'sdapi/v1/samplers' + str.errTimeout) }
        return true
    }
    this.exit = function () {
        sendMessage({ type: 'exit' })
    }
    this.setOptions = function (checkpoint, vae, vae_path) {
        var message = {}
        message['sd_model_checkpoint'] = checkpoint ? checkpoint.replace(/\\/g, '\\\\') : null
        message['sd_vae'] = vae
        if (SdCfg.forgeUI) message['forge_additional_modules'] = vae_path
        if (sendMessage({ type: 'update', message: message }, true, SD_RELOAD_CHECKPOINT_DELAY)) return true
        return false;
    }
    this.sendPayload = function (payload) {
        var result = sendMessage({ type: 'payload', message: payload }, true, SD_GENERATION_DELAY)
        if (result) return result['message']
        return null;
    }
    this.translate = function (s) {
        var result = sendMessage({ type: 'translate', message: s }, true, SD_RELOAD_CHECKPOINT_DELAY)
        if (result) return result['message']
        return null;
    }
    function checkConnecton(host) {
        var socket = new Socket,
            answer = socket.open(host);
        socket.close()
        return answer
    }
    function sendMessage(o, getAnswer, delay) {
        var tcp = new Socket,
            delay = delay ? delay : SD_GET_OPTIONS_DELAY;
        tcp.open(apiHost + ':' + portSend, 'UTF-8')
        tcp.writeln(objectToJSON(o))
        tcp.close()
        if (getAnswer) {
            var t1 = (new Date).getTime(),
                t2 = 0;
            var tcp = new Socket;
            if (tcp.listen(portListen, 'UTF-8')) {
                for (; ;) {
                    t2 = (new Date).getTime()
                    if (t2 - t1 > delay) return null;
                    var answer = tcp.poll();
                    if (answer != null) {
                        var a = eval('(' + answer.readln() + ')');
                        answer.close();
                        return a;
                    }
                }
            }
        }
    }
    function objectToJSON(obj) {
        if (obj === null) {
            return 'null';
        }
        if (typeof obj !== 'object') {
            return '"' + obj + '"';
        }
        if (obj instanceof Array) {
            var arr = [];
            for (var i = 0; i < obj.length; i++) {
                arr.push(objectToJSON(obj[i]));
            }
            return '[' + arr.join(',') + ']';
        }
        var keys = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        var result = [];
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = objectToJSON(obj[key]);
            result.push('"' + key + '":' + value);
        }
        return '{' + result.join(',') + '}';
    }
}
function AM(target, order) {
    var s2t = stringIDToTypeID,
        t2s = typeIDToStringID,
        AR = ActionReference,
        AD = ActionDescriptor,
        AL = ActionList;
    target = target ? s2t(target) : null;
    this.getProperty = function (property, descMode, id, idxMode) {
        property = s2t(property);
        (r = new AR).putProperty(s2t('property'), property);
        id != undefined ? (idxMode ? r.putIndex(target, id) : r.putIdentifier(target, id)) :
            r.putEnumerated(target, s2t('ordinal'), order ? s2t(order) : s2t('targetEnum'));
        return descMode ? executeActionGet(r) : getDescValue(executeActionGet(r), property);
    }
    this.hasProperty = function (property, id, idxMode) {
        property = s2t(property);
        (r = new AR).putProperty(s2t('property'), property);
        id ? (idxMode ? r.putIndex(target, id) : r.putIdentifier(target, id))
            : r.putEnumerated(target, s2t('ordinal'), s2t('targetEnum'));
        try { return executeActionGet(r).hasKey(property) } catch (e) { return false }
    }
    this.setProperty = function (property, desc) {
        property = s2t(property);
        (r = new AR).putProperty(s2t('property'), property);
        r.putEnumerated(target, s2t('ordinal'), s2t('targetEnum'));
        (d = new ActionDescriptor).putReference(s2t('null'), r);
        d.putObject(s2t('to'), property, desc);
        executeAction(s2t('set'), d, DialogModes.NO);
    }
    this.descToObject = function (d) {
        var o = {}
        for (var i = 0; i < d.count; i++) {
            var k = d.getKey(i)
            o[t2s(k)] = getDescValue(d, k)
        }
        return o
    }
    this.flatten = function () { executeAction(s2t('flattenImage'), undefined, DialogModes.NO); }
    this.saveACopy = function (pth) {
        (d1 = new AD).putInteger(s2t('extendedQuality'), 12);
        d1.putEnumerated(s2t('matteColor'), s2t('matteColor'), s2t('none'));
        (d = new AD).putObject(s2t('as'), s2t('JPEG'), d1);
        d.putPath(s2t('in'), pth);
        d.putBoolean(s2t('copy'), true);
        executeAction(s2t('save'), d, DialogModes.NO);
    }
    this.makeSelection = function (bounds, addTo) {
        (r = new AR).putProperty(s2t('channel'), s2t('selection'));
        (d = new AD).putReference(s2t('null'), r);
        (d1 = new AD).putUnitDouble(s2t('top'), s2t('pixelsUnit'), bounds.top);
        d1.putUnitDouble(s2t('left'), s2t('pixelsUnit'), bounds.left);
        d1.putUnitDouble(s2t('bottom'), s2t('pixelsUnit'), bounds.bottom);
        d1.putUnitDouble(s2t('right'), s2t('pixelsUnit'), bounds.right);
        d.putObject(s2t('to'), s2t('rectangle'), d1);
        executeAction(s2t(addTo ? 'addTo' : 'set'), d, DialogModes.NO);
    }
    this.deleteLayer = function (id) {
        (r = new AR).putIdentifier(s2t('layer'), id);
        (d = new AD).putReference(s2t('null'), r);
        executeAction(s2t('delete'), d, DialogModes.NO);
    }
    this.makeSelectionFromLayer = function (targetEnum, id) {
        (r = new AR).putProperty(s2t('channel'), s2t('selection'));
        (d = new AD).putReference(s2t('null'), r);
        (r1 = new AR).putEnumerated(s2t('channel'), s2t('channel'), s2t(targetEnum));
        if (id) r1.putIdentifier(s2t('layer'), id);
        d.putReference(s2t('to'), r1);
        executeAction(s2t('set'), d, DialogModes.NO);
    }
    this.deselect = function () {
        (r = new AR).putProperty(s2t('channel'), s2t('selection'));
        (d = new AD).putReference(s2t('null'), r);
        d.putEnumerated(s2t('to'), s2t('ordinal'), s2t('none'));
        executeAction(s2t('set'), d, DialogModes.NO);
    }
    this.selectBrush = function () {
        (r = new AR).putClass(s2t('paintbrushTool'));
        (d = new AD).putReference(s2t('null'), r);
        executeAction(s2t('select'), d, DialogModes.NO);
    }
    this.setBrushOpacity = function (opacity) {
        (r = new AR).putProperty(s2t('property'), p = s2t('currentToolOptions'));
        r.putEnumerated(s2t('application'), s2t('ordinal'), s2t('targetEnum'));
        var tool = executeActionGet(r).getObjectValue(p);
        tool.putInteger(s2t('opacity'), opacity);
        (r = new AR).putClass(s2t(currentTool));
        (d = new AD).putReference(s2t('target'), r);
        d.putObject(s2t('to'), s2t('target'), tool);
        executeAction(s2t('set'), d, DialogModes.NO);
    }
    this.resetSwatches = function () {
        (r = new AR).putProperty(s2t('color'), s2t('colors'));
        (d = new AD).putReference(s2t('null'), r);
        executeAction(s2t('reset'), d, DialogModes.NO);
    }
    this.selectChannel = function (channel) {
        (r = new AR).putEnumerated(s2t('channel'), s2t('channel'), s2t(channel));
        (d = new AD).putReference(s2t('null'), r);
        executeAction(s2t('select'), d, DialogModes.NO);
    }
    this.quickMask = function (evt) {
        (r = new AR).putProperty(s2t('property'), s2t('quickMask'));
        r.putEnumerated(s2t('document'), s2t('ordinal'), s2t('targetEnum'));
        (d = new AD).putReference(s2t('null'), r);
        executeAction(s2t(evt), d, DialogModes.NO);
    }
    this.crop = function (deletePixels) {
        (d = new AD).putBoolean(s2t('delete'), deletePixels);
        executeAction(s2t('crop'), d, DialogModes.NO);
    }
    this.selectLayersByIDList = function (IDList) {
        (d = new AD).putReference(s2t('null'), IDList)
        executeAction(s2t('select'), d, DialogModes.NO)
    }
    this.hideSelectedLayers = function () {
        (r = new AR).putEnumerated(s2t('layer'), s2t('ordinal'), s2t('targetEnum'));
        (l = new AL).putReference(r);
        (d = new AD).putList(s2t('null'), l);
        executeAction(s2t('hide'), d, DialogModes.NO);
    }
    this.setName = function (title) {
        (r = new AR).putEnumerated(s2t('layer'), s2t('ordinal'), s2t('targetEnum'));
        (d = new AD).putReference(s2t('null'), r);
        (d1 = new AD).putString(s2t('name'), title);
        d.putObject(s2t('to'), s2t('layer'), d1);
        executeAction(s2t('set'), d, DialogModes.NO);
    }
    this.place = function (pth) {
        (d = new AD).putPath(s2t('null'), pth);
        d.putBoolean(s2t('linked'), false);
        executeAction(s2t('placeEvent'), d, DialogModes.NO);
    }
    this.rasterize = function () {
        (d = new AD).putReference(s2t('target'), r);
        executeAction(s2t('rasterizePlaced'), d, DialogModes.NO);
    }
    this.makeSelectionMask = function () {
        (d = new AD).putClass(s2t('new'), s2t('channel'));
        (r = new AR).putEnumerated(s2t('channel'), s2t('channel'), s2t('mask'));
        d.putReference(s2t('at'), r);
        d.putEnumerated(s2t('using'), s2t('userMask'), s2t('revealSelection'));
        executeAction(s2t('make'), d, DialogModes.NO);
    }
    this.transform = function (dw, dh) {
        (d = new AD).putEnumerated(s2t('freeTransformCenterState'), s2t('quadCenterState'), s2t('QCSAverage'));
        (d1 = new AD).putUnitDouble(s2t('horizontal'), s2t('pixelsUnit'), 0);
        d1.putUnitDouble(s2t('vertical'), s2t('pixelsUnit'), 0);
        d.putObject(s2t('offset'), s2t('offset'), d1);
        d.putUnitDouble(s2t('width'), s2t('percentUnit'), dw);
        d.putUnitDouble(s2t('height'), s2t('percentUnit'), dh);
        executeAction(s2t('transform'), d, DialogModes.NO);
    }
    this.makeLayer = function (title) {
        (r = new AR).putClass(s2t('layer'));
        (d = new AD).putReference(s2t('null'), r);
        (d1 = new AD).putString(s2t('name'), title)
        d.putObject(s2t('using'), s2t('layer'), d1);
        executeAction(s2t('make'), d, DialogModes.NO);
    }
    this.selectAllPixels = function () {
        (r = new AR).putProperty(s2t('channel'), s2t('selection'));
        (d = new AD).putReference(s2t('null'), r);
        d.putEnumerated(s2t('to'), s2t('ordinal'), s2t('allEnum'));
        executeAction(s2t('set'), d, DialogModes.NO);
    }
    this.copyPixels = function () {
        (d = new AD).putString(s2t('copyHint'), 'pixels');
        executeAction(s2t('copyEvent'), d, DialogModes.NO);
    }
    this.pastePixels = function () {
        (d = new AD).putEnumerated(s2t('antiAlias'), s2t('antiAliasType'), s2t('antiAliasNone'));
        d.putClass(s2t('as'), s2t('pixel'));
        executeAction(s2t('paste'), d, DialogModes.NO);
    }
    function getDescValue(d, p) {
        switch (d.getType(p)) {
            case DescValueType.OBJECTTYPE: return { type: t2s(d.getObjectType(p)), value: d.getObjectValue(p) };
            case DescValueType.LISTTYPE: return d.getList(p);
            case DescValueType.REFERENCETYPE: return d.getReference(p);
            case DescValueType.BOOLEANTYPE: return d.getBoolean(p);
            case DescValueType.STRINGTYPE: return d.getString(p);
            case DescValueType.INTEGERTYPE: return d.getInteger(p);
            case DescValueType.LARGEINTEGERTYPE: return d.getLargeInteger(p);
            case DescValueType.DOUBLETYPE: return d.getDouble(p);
            case DescValueType.ALIASTYPE: return d.getPath(p);
            case DescValueType.CLASSTYPE: return d.getClass(p);
            case DescValueType.UNITDOUBLE: return (d.getUnitDoubleValue(p));
            case DescValueType.ENUMERATEDTYPE: return { type: t2s(d.getEnumerationType(p)), value: t2s(d.getEnumerationValue(p)) };
            default: break;
        };
    }
}
function Config() {
    this.inpaintMode = false
    this.current = new scriptSettings();
    this.img2img = new scriptSettings();
    this.inpaint = new scriptSettings();
    this.vae = 'sdapi/v1/sd-vae'
    function scriptSettings() {
        this.sd_model_checkpoint = ''
        this.sd_vae = 'Automatic'
        this.scheduler = 'Automatic'
        this.sampler_name = 'DPM++ 2M'
        this.cfg_scale = 7
        this.steps = 20
        this.denoising_strength = 0.22
        this.prompt = ''
        this.negative_prompt = '(deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, (mutated hands and fingers:1.4), disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation'
        this.resize = 1
        this.flatten = false
        this.rasterizeImage = true
        this.inpaintingFill = 1
        this.showInpaintingFill = true
        this.showSd_model_checkpoint = true
        this.showSd_vae = true
        this.showPrompt = true
        this.showNegative_prompt = true
        this.showSampler_name = true
        this.showScheduler = true
        this.showSteps = true
        this.showCfg_scale = true
        this.showResize = true
        this.selectBrush = true
        this.brushOpacity = 50
        this.recordToAction = true
        this.autoResize = false
        this.autoResizeLess = 512
        this.autoResizeAbove = 1408
    }
    settingsObj = this;
    this.getScriptSettings = function (fromAction) {
        if (fromAction) var d = playbackParameters; else try { var d = getCustomOptions(UUID) } catch (e) { };
        if (d != undefined)
            if (d.hasKey(s2t('dialogMode'))) eraseCustomOptions(UUID)
            else descriptorToObject(settingsObj, d)
        if (settingsObj.inpaintMode) {
            settingsObj.current = settingsObj.inpaint
        } else {
            settingsObj.current = settingsObj.img2img
        }
        function descriptorToObject(o, d) {
            var l = d.count;
            for (var i = 0; i < l; i++) {
                var k = d.getKey(i),
                    t = d.getType(k),
                    s = app.typeIDToStringID(k);
                switch (t) {
                    case DescValueType.BOOLEANTYPE: o[s] = d.getBoolean(k); break;
                    case DescValueType.STRINGTYPE: o[s] = d.getString(k); break;
                    case DescValueType.DOUBLETYPE: o[s] = d.getDouble(k); break;
                    case DescValueType.OBJECTTYPE: descriptorToObject(o[s], d.getObjectValue(k)); break;
                }
            }
        }
    }
    this.putScriptSettings = function (toAction, swapSettings) {
        if (!swapSettings) {
            if (settingsObj.inpaintMode) {
                settingsObj.inpaint = settingsObj.current
            } else {
                settingsObj.img2img = settingsObj.current
            }
            delete settingsObj.current;
        }
        var d = objectToDescriptor(settingsObj, UUID)
        if (toAction) playbackParameters = d else putCustomOptions(UUID, d, true);
        function objectToDescriptor(o) {
            var d = new ActionDescriptor;
            var l = o.reflect.properties.length;
            for (var i = 0; i < l; i++) {
                var k = o.reflect.properties[i].toString();
                if (k == '__proto__' || k == '__count__' || k == '__class__' || k == 'reflect') continue;
                var v = o[k];
                k = app.stringIDToTypeID(k);
                switch (typeof (v)) {
                    case 'boolean': d.putBoolean(k, v); break;
                    case 'string': d.putString(k, v); break;
                    case 'number': d.putDouble(k, v); break;
                    case 'object':
                        d.putObject(k, s2t('object'), objectToDescriptor(v));
                        break;
                }
            }
            return d;
        }
    }
}
function Locale() {
    this.actionMode = { ru: 'Не записывать параметры генерации в экшен', en: 'Do not record generation settings to action' }
    this.apply = { ru: 'Применить настройки', en: 'Apply settingsa' }
    this.autoResize = { ru: 'Авто масштаб', en: 'Auto resize' }
    this.autoResizeCaption = { ru: 'Масштаб зависит от размера выделения', en: 'Set scale value based on selection size' }
    this.brush = { ru: 'Настройки кисти', en: 'Brush settings' }
    this.cfgScale = 'CFG Scale'
    this.checkpoint = 'Stable Diffusion checkpoint'
    this.errAnswer = { ru: 'не отвечает!', en: 'not answering!' }
    this.errConnection = { ru: 'Невозможно установить соединение c ', en: 'Impossible to establish a connection with ' }
    this.errExists = { ru: ' пуст!\nУбедитесь что они добавлены в папку Stable Diffusion', en: ' is empty!\nMake sure that it exists in the Stable Diffusion folder' }
    this.errGenerating = { ru: 'Превышено время ожидания ответа Stable Diffusion!', en: 'Exceeded time waiting for the response of Stable Diffusion!' }
    this.errList = { ru: 'Список ', en: 'List ' }
    this.errSettings = { ru: 'Невозможно получить параметры ', en: 'Impossible to get the settings ' }
    this.errTimeout = { ru: '\nПревышено время ожидания ответа!', en: '\nExceeding the response time!' }
    this.errTranslate = { ru: 'Модуль перевода недоступен!', en: 'The translation module is not available!' }
    this.errUpdating = { ru: 'Переключение на выбранную модель завершилось с ошибкой!\nПревышено время ожидания ответа!', en: 'Switching to the selected checkpoint ended with the error!\nExceeded the response time!' }
    this.fill = 'Inpainting fill mode'
    this.flatten = { ru: 'Склеивать слои перед генерацией', en: 'Flatten layers before generation' }
    this.generate = { ru: 'Генерация', en: 'Generate' }
    this.max = { ru: 'максимум, px', en: 'maximum, px' }
    this.min = { ru: 'минимум, px', en: 'minimum, px' }
    this.module = { ru: 'Модуль sd-webui-api ', en: 'Module sd-webui-api ' }
    this.negativePrompt = 'Negative prompt'
    this.notFound = { ru: '\nне найден!', en: 'not found!' }
    this.opacity = { ru: 'Непрозрачность кисти', en: 'Brush opacity' }
    this.output = { ru: 'Параметры изображения', en: 'Image settings' }
    this.progressDocument = { ru: 'Подготовка документа...', en: 'Preparation of a document...' }
    this.progressGenerate = { ru: 'Генерация изображения...', en: 'Image generation...' }
    this.progressPlace = { ru: 'Вставка изображения...', en: 'Image placing...' }
    this.progressUpdating = { ru: 'Обновление параметров генерации...', en: 'Update generation parameters...' }
    this.prompt = 'Prompt'
    this.rasterize = { ru: 'Растеризовать сгенерированное изображение', en: 'Rasterize generated image' }
    this.resize = 'Resize by scale'
    this.sampling = 'Sampling method'
    this.schedule = 'Schedule type'
    this.selctBrush = { ru: 'Активировать кисть после генерации', en: 'Select brush after processing' }
    this.selection = { ru: 'Выделение: ', en: 'Selection: ' }
    this.settings = { ru: 'Настройки скрипта', en: 'Script settings' }
    this.showItems = { ru: 'Показывать опции', en: 'Show items' }
    this.steps = 'Sampling steps'
    this.strength = 'Denoising strength'
    this.translate = { ru: 'перевести: ', en: 'translate: ' }
    this.vae = 'SD VAE'
}