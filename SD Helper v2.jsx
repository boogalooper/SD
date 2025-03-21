#target photoshop
/*
// BEGIN__HARVEST_EXCEPTION_ZSTRING
<javascriptresource> 
<name>SD helper</name> 
<eventid>338cc304-fb6f-4b1f-8ad4-13bbd65f117c</eventid>
<terminology><![CDATA[<< /Version 1
                        /Events <<
                        /338cc304-fb6f-4b1f-8ad4-13bbd65f117c [(SD helper) <<
                        >>]
                         >>
                      >> ]]></terminology>
</javascriptresource>
// END__HARVEST_EXCEPTION_ZSTRING
*/
const LOCALHOST = "127.0.0.1",
    SD_PORT = 7860,
    API_PORT_SEND = 6320,
    API_PORT_LISTEN = 6321,
    API_FILE = "sd-webui-api v2.pyw",
    LAYER_NAME = "SD generated image",
    UUID = "338cc304-fb6f-4b1f-8ad4-13bbd65f117c",
    SD_GET_OPTIONS_DELAY = 1500,
    SD_RELOAD_CHECKPOINT_DELAY = 10000,
    SD_GENERATION_DELAY = 120000;
var time = (new Date).getTime(),
    SD = new SDApi(LOCALHOST, SD_PORT, API_PORT_SEND, API_PORT_LISTEN, new File((new File($.fileName)).path + '/' + API_FILE)),
    s2t = stringIDToTypeID,
    t2s = typeIDToStringID,
    cfg = new Config(),
    apl = new AM('application'),
    doc = new AM('document'),
    lr = new AM('layer'),
    ch = new AM('channel'),
    isCancelled = false,
    targetID = null,
    cleanup = false;
if (ScriptUI.environment.keyboardState.shiftKey) $.setenv('dialogMode', true)
try { init() } catch (e) {
    SD.exit()
    if (cleanup && targetID) doc.deleteLayer(targetID)
    alert(e)
    isCancelled = true;
}
isCancelled ? 'cancel' : undefined
function init() {
    var b = checkSelection();
    if (b && (!app.playbackParameters.count || app.playbackParameters.count == 1)) {
        cfg.getScriptSettings();
        if (app.playbackParameters.count == 1) $.setenv('dialogMode', true)
        if (($.getenv('dialogMode') == 'true' || $.getenv('dialogMode') == null) && b) {
            if (b && SD.initialize()) {
                var w = dialogWindow(b, (((new Date).getTime() - time) / 1000)); var result = w.show()
                if (result == 2) {
                    if (cleanup && targetID) doc.deleteLayer(targetID)
                    SD.exit()
                    isCancelled = true;
                    return;
                } else if (result != undefined) {
                    $.setenv('dialogMode', false)
                    cfg.putScriptSettings(true)
                    cfg.putScriptSettings()
                    doProgress('Генерация изображения... ', 'main(b)')
                    SD.exit()
                }
            }
        } else {
            if (b && SD.initialize()) {
                $.setenv('dialogMode', false)
                cfg.putScriptSettings(true)
                doProgress('Генерация изображения... ', 'main(b)')
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
        if (!cfg.recordToAction) cfg.getScriptSettings()
        cfg.recordToAction = false;
        if (app.playbackDisplayDialogs == DialogModes.ALL) {
            if (b && SD.initialize()) {
                var w = dialogWindow(b, (((new Date).getTime() - time) / 1000)); var result = w.show()
                if (result == 2) {
                    if (cleanup && targetID) doc.deleteLayer(targetID)
                    SD.exit()
                    isCancelled = true;
                    return;
                } else if (result != undefined) {
                    if (cfg.recordToAction) cfg.putScriptSettings(true) else cfg.putScriptSettings()
                    doProgress('Генерация изображения... ', 'main(b)')
                    SD.exit()
                }
            }
        } else {
            if (b && SD.initialize()) { doProgress('Генерация изображения... ', 'main(b)') }
            SD.exit()
        }
    }
}
function main(bounds) {
    var checkpoint = (cfg.sd_model_checkpoint == SD['sd_model_checkpoint'] ? null : findOption(cfg.sd_model_checkpoint, SD['sd-models'], SD['sd_model_checkpoint'])),
        vae = (cfg.sd_vae == SD['sd_vae'] ? null : findOption(cfg.sd_vae, SD['sd-vaes'], SD['sd_vae']));
    if (vae != cfg.sd_vae) cfg.sd_vae = vae
    if (checkpoint != cfg.sd_model_checkpoint) cfg.sd_model_checkpoint = checkpoint
    doc.makeSelection(bounds.top, bounds.left, bounds.bottom, bounds.right);
    var hst = activeDocument.activeHistoryState,
        c = doc.getProperty('center').value;
    if (targetID) doc.hideSelectedLayers()
    doc.crop(true);
    if (cfg.flatten) { doc.flatten() } else {
        var len = doc.getProperty('numberOfLayers'),
            start = lr.getProperty('itemIndex'),
            lrsList = new ActionReference();
        offset = doc.getProperty('hasBackgroundLayer') ? 0 : 1;
        for (var i = start + offset; i <= len; i++) lrsList.putIdentifier(s2t("layer"), lr.getProperty('layerID', false, i, true));
        if (start + offset <= len) {
            doc.selectLayersByIDList(lrsList);
            doc.hideSelectedLayers();
        }
    }
    var f = new File(Folder.temp + '/SDH.jpg');
    doc.saveACopy(f);
    activeDocument.activeHistoryState = hst;
    doc.setProperty('center', c);
    activeDocument.suspendHistory('Generate image', 'function(){}')
    var p = (new Folder(SD['data_dir'] + '/' + SD['outdir_img2img_samples']))
    if (!p.exists) p.create()
    if (checkpoint || vae) {
        changeProgressText("Обновление параметров...")
        updateProgress(0.1, 1)
        if (!SD.setOptions(checkpoint, vae)) throw new Error("Переключение модели завершилось с ошибкой!\nПревышено время ожидания ответа!")
    }
    changeProgressText("Подготовка документа...")
    updateProgress(0.2, 1)
    var width = cfg.resize != 1 ? (mathTrunc((bounds.width * cfg.resize) / 8) * 8) : bounds.width,
        height = cfg.resize != 1 ? (mathTrunc((bounds.height * cfg.resize) / 8) * 8) : bounds.height
    var payload = {
        "input": f.fsName.replace(/\\/g, '\\\\'),
        "output": p.fsName.replace(/\\/g, '\\\\'),
        "prompt": cfg.prompt,
        "negative_prompt": cfg.negative_prompt,
        "sampler_name": cfg.sampler_name,
        "scheduler": cfg.scheduler,
        "cfg_scale": cfg.cfg_scale,
        "seed": -1,
        "steps": cfg.steps,
        "width": width,
        "height": height,
        "denoising_strength": cfg.denoising_strength,
        "n_iter": 1,
    };
    updateProgress(0.7, 1)
    changeProgressText("Генерация изображения...")
    app.refresh()
    var result = SD.sendPayload(payload);
    if (result) {
        updateProgress(1, 1)
        changeProgressText("Вставка изображения...")
        doc.place(new File(result))
        var placedBounds = doc.descToObject(lr.getProperty('bounds').value);
        var dW = (bounds.right - bounds.left) / (placedBounds.right - placedBounds.left);
        var dH = (bounds.bottom - bounds.top) / (placedBounds.bottom - placedBounds.top)
        lr.transform(dW * 100, dH * 100);
        if (cfg.rasterizeImage) lr.rasterize();
        lr.setName(LAYER_NAME)
        if (targetID) {
            doc.makeSelectionFromLayer('mask', targetID)
            doc.makeSelectionMask()
            doc.deleteLayer(targetID)
        } else {
            doc.makeSelectionFromLayer('transparencyEnum')
            doc.makeSelectionMask()
        }
        doc.selectUserMask();
        if (cfg.selectBrush) {
            doc.resetSwatches()
            doc.selectBrush();
            doc.setBrushOpacity(cfg.brushOpacity)
        }
        if (cfg.removeImage) {
            (new File(result)).remove();
        }
    } else throw new Error('Превышено время ожидания ответа Stable Diffusion!')
    function findOption(s, o, def) {
        for (a in o) if (o[a] == s) return s;
        return def;
    }
}
function dialogWindow(b, s) {
    var w = new Window("dialog");
    w.text = "SD Helper - responce time " + s + 's';
    w.orientation = "column";
    w.alignChildren = ["fill", "top"];
    w.spacing = 10;
    w.margins = 16;
    var grGlobal = w.add("group");
    grGlobal.orientation = "row";
    grGlobal.alignChildren = ["left", "center"];
    grGlobal.spacing = 0;
    grGlobal.margins = 0;
    var stWH = grGlobal.add("statictext");
    stWH.text = 'Selection size: ' + b.width + 'x' + b.height;
    stWH.preferredSize.width = 260;
    var bnSettings = grGlobal.add("button");
    bnSettings.text = "⚙";
    bnSettings.helpTip = 'Script settings'
    bnSettings.preferredSize = [25, 25];
    bnSettings.onClick = function () {
        var tempSettings = {}
        cloneObject(cfg, tempSettings)
        var s = settingsWindow(w, tempSettings),
            result = s.show();
        if (result == 1) {
            var isDitry = false;
            for (var a in tempSettings) {
                if (a.indexOf('show') == -1) continue;
                if (tempSettings[a] != cfg[a]) {
                    isDitry = true
                    break;
                }
            }
            cloneObject(tempSettings, cfg)
            if (isDitry) {
                var len = grSettings.children.length
                for (var i = 0; i < len; i++) {
                    grSettings.remove(grSettings.children[0])
                }
                showControls(grSettings)
                w.layout.layout(true)
            }
        }
    }
    var grSettings = w.add("group");
    grSettings.orientation = "column";
    grSettings.alignChildren = ["fill", "left"];
    grSettings.spacing = 5;
    grSettings.margins = 0;
    showControls(grSettings);
    var grOk = w.add("group");
    grOk.orientation = "row";
    grOk.alignChildren = ["center", "center"];
    grOk.spacing = 10;
    grOk.margins = [0, 10, 0, 0];;
    var Ok = grOk.add("button", undefined, undefined, { name: "ok" });
    Ok.text = "Generate";
    return w;
    function showControls(w) {
        if (cfg.showSd_model_checkpoint) checkpoint(w);
        if (cfg.showSd_vae) vae(w)
        if (cfg.showPrompt) prompt(w)
        if (cfg.showNegative_prompt) negativePrompt(w)
        if (cfg.showSampler_name) sampler(w)
        if (cfg.showScheduler) shelduler(w)
        if (cfg.showSteps) steps(w)
        if (cfg.showCfg_scale) cfgScale(w)
        if (cfg.showResize) resizeScale(w)
        denoisingStrength(w)
        function checkpoint(w) {
            var grCheckoint = w.add("group");
            grCheckoint.orientation = "column";
            grCheckoint.alignChildren = ["fill", "center"];
            grCheckoint.spacing = 0;
            grCheckoint.margins = 0;
            var stCheckpoint = grCheckoint.add("statictext");
            stCheckpoint.text = "Stable Diffusion checkpoint";
            var dlCheckpoint = grCheckoint.add("dropdownlist");
            dlCheckpoint.preferredSize.width = 285;
            if (SD['sd-models'].length) for (var i = 0; i < SD['sd-models'].length; i++) dlCheckpoint.add('item', SD['sd-models'][i])
            var current = dlCheckpoint.find(cfg.sd_model_checkpoint) ? dlCheckpoint.find(cfg.sd_model_checkpoint) : dlCheckpoint.find(SD['sd_model_checkpoint']);
            dlCheckpoint.selection = current ? current.index : 0
            dlCheckpoint.onChange = function () {
                cfg.sd_model_checkpoint = this.selection.text
            }
        }
        function vae(w) {
            var grVae = w.add("group");
            grVae.orientation = "column";
            grVae.alignChildren = ["fill", "center"];
            grVae.spacing = 0;
            grVae.margins = 0;
            var stVae = grVae.add("statictext");
            stVae.text = "SD VAE";
            var dlVae = grVae.add("dropdownlist");
            dlVae.preferredSize.width = 285;
            if (SD['sd-vaes'].length) for (var i = 0; i < SD['sd-vaes'].length; i++) dlVae.add('item', SD['sd-vaes'][i])
            var current = dlVae.find(cfg.sd_vae) ? dlVae.find(cfg.sd_vae) : dlVae.find(SD['sd_vae']);
            dlVae.selection = current ? current.index : 0
            dlVae.onChange = function () {
                cfg.sd_vae = this.selection.text
            }
        }
        function prompt(w) {
            var grPrompt = w.add("group");
            grPrompt.orientation = "column";
            grPrompt.alignChildren = ["fill", "top"];
            grPrompt.spacing = 0;
            grPrompt.margins = 0;
            var stPrompt = grPrompt.add("statictext");
            stPrompt.text = "Prompt";
            var etPrompt = grPrompt.add('edittext {properties: {multiline: true, scrollable: true}}');
            etPrompt.preferredSize.height = 80;
            etPrompt.text = cfg.prompt
            etPrompt.onChange = function () {
                cfg.prompt = this.text
            }
        }
        function negativePrompt(w) {
            var grNegative = w.add("group");
            grNegative.orientation = "column";
            grNegative.alignChildren = ["fill", "top"];
            grNegative.spacing = 0;
            grNegative.margins = 0;
            var stNegative = grNegative.add("statictext");
            stNegative.text = "Negative prompt";
            var etNegative = grNegative.add('edittext {properties: {multiline: true, scrollable: true}}}');
            etNegative.preferredSize.height = 80;
            etNegative.text = cfg.negative_prompt;
            etNegative.onChange = function () {
                cfg.negative_prompt = this.text
            }
        }
        function sampler(w) {
            var grSampler = w.add("group");
            grSampler.orientation = "column";
            grSampler.alignChildren = ["fill", "center"];
            grSampler.spacing = 0;
            grSampler.margins = 0;
            var stSampler = grSampler.add("statictext");
            stSampler.text = "Sampling method";
            var dlSampler = grSampler.add("dropdownlist");
            dlSampler.preferredSize.width = 285;
            if (SD['samplers'].length) for (var i = 0; i < SD['samplers'].length; i++) dlSampler.add('item', SD['samplers'][i])
            var current = dlSampler.find(cfg.sampler_name);
            dlSampler.selection = current ? current.index : 0
            dlSampler.onChange = function () {
                cfg.sampler_name = this.selection.text
            }
        }
        function shelduler(w) {
            var grSheldue = w.add("group");
            grSheldue.orientation = "column";
            grSheldue.alignChildren = ["fill", "center"];
            grSheldue.spacing = 0;
            grSheldue.margins = 0;
            var stSheldue = grSheldue.add("statictext");
            stSheldue.text = "Schedule type";
            var dlSheldue = grSheldue.add("dropdownlist");
            if (SD['schedulers'].length) for (var i = 0; i < SD['schedulers'].length; i++) dlSheldue.add('item', SD['schedulers'][i])
            var current = dlSheldue.find(cfg.scheduler);
            dlSheldue.selection = current ? current.index : 0
            dlSheldue.onChange = function () {
                cfg.scheduler = this.selection.text
            }
        }
        function steps(w) {
            var grSteps = w.add("group");
            grSteps.orientation = "column";
            grSteps.alignChildren = ["fill", "top"];
            grSteps.spacing = 0;
            grSteps.margins = 0;
            var grStepsTitle = grSteps.add("group");
            grStepsTitle.orientation = "row";
            grStepsTitle.alignChildren = ["left", "center"];
            grStepsTitle.spacing = 10;
            grStepsTitle.margins = 0;
            var stSteps = grStepsTitle.add("statictext");
            stSteps.text = "Sampling steps";
            stSteps.preferredSize.width = 220;
            var stStepsValue = grStepsTitle.add("statictext");
            stStepsValue.preferredSize.width = 65;
            stStepsValue.justify = "right";
            stStepsValue.graphics.foregroundColor = stStepsValue.graphics.newPen(stStepsValue.graphics.PenType.SOLID_COLOR, [0.48, 0.76, 0.34, 1], 1)
            var slSteps = grSteps.add("slider");
            slSteps.minvalue = 1;
            slSteps.maxvalue = 100;
            slSteps.value = stStepsValue.text = cfg.steps
            slSteps.onChange = function () {
                stStepsValue.text = cfg.steps = mathTrunc(this.value)
            }
            slSteps.onChanging = function () { slSteps.onChange() }
            slSteps.addEventListener('keydown', commonHandler)
            function commonHandler(evt) {
                if (evt.shiftKey) {
                    if (evt.keyIdentifier == 'Right' || evt.keyIdentifier == 'Up') {
                        slSteps.value = Math.floor(slSteps.value / 5) * 5 + 4
                    } else if (evt.keyIdentifier == 'Left' || evt.keyIdentifier == 'Down') {
                        slSteps.value = Math.ceil(slSteps.value / 5) * 5 - 4
                    }
                }
            }
        }
        function cfgScale(w) {
            var grCfg = w.add("group");
            grCfg.orientation = "column";
            grCfg.alignChildren = ["fill", "top"];
            grCfg.spacing = 0;
            grCfg.margins = 0;
            var grCfgTitle = grCfg.add("group");
            grCfgTitle.orientation = "row";
            grCfgTitle.alignChildren = ["left", "center"];
            grCfgTitle.spacing = 10;
            grCfgTitle.margins = 0;
            var stCfg = grCfgTitle.add("statictext");
            stCfg.text = "CFG Scale";
            stCfg.preferredSize.width = 220;
            var stCfgValue = grCfgTitle.add("statictext");
            stCfgValue.justify = "right";
            stCfgValue.preferredSize.width = 65
            stCfgValue.graphics.foregroundColor = stCfgValue.graphics.newPen(stCfgValue.graphics.PenType.SOLID_COLOR, [0.48, 0.76, 0.34, 1], 1)
            var slCfg = grCfg.add("slider");
            slCfg.minvalue = 2;
            slCfg.maxvalue = 30;
            slCfg.value = cfg.cfg_scale * 2
            stCfgValue.text = cfg.cfg_scale
            slCfg.onChange = function () {
                stCfgValue.text = cfg.cfg_scale = mathTrunc(this.value) / 2
            }
            slCfg.onChanging = function () { slCfg.onChange() }
            slCfg.addEventListener('keydown', commonHandler)
            function commonHandler(evt) {
                if (evt.shiftKey) {
                    if (evt.keyIdentifier == 'Right' || evt.keyIdentifier == 'Up') {
                        slCfg.value = Math.floor(slCfg.value / 5) * 5 + 4
                    } else if (evt.keyIdentifier == 'Left' || evt.keyIdentifier == 'Down') {
                        slCfg.value = Math.ceil(slCfg.value / 5) * 5 - 4
                    }
                }
            }
        }
        function resizeScale(w) {
            var s = "Resize by scale";
            var grResize = w.add("group");
            grResize.orientation = "column";
            grResize.alignChildren = ["fill", "top"];
            grResize.spacing = 0;
            grResize.margins = 0;
            var grResizeTitle = grResize.add("group");
            grResizeTitle.orientation = "row";
            grResizeTitle.alignChildren = ["left", "center"];
            grResizeTitle.spacing = 10;
            grResizeTitle.margins = 0;
            var stResize = grResizeTitle.add("statictext");
            stResize.text = cfg.resize != 1 ? s + ' ' + (mathTrunc((b.width * cfg.resize) / 8) * 8) + 'x' + (mathTrunc((b.height * cfg.resize) / 8) * 8) : s
            stResize.preferredSize.width = 220;
            var stResizeValue = grResizeTitle.add("statictext");
            stResizeValue.justify = "right";
            stResizeValue.preferredSize.width = 65
            stResizeValue.text = "1";
            stResizeValue.graphics.foregroundColor = stResizeValue.graphics.newPen(stResizeValue.graphics.PenType.SOLID_COLOR, [0.48, 0.76, 0.34, 1], 1)
            var slResize = grResize.add("slider");
            slResize.minvalue = 1;
            slResize.maxvalue = 40;
            slResize.value = cfg.resize * 10
            stResizeValue.text = cfg.resize
            slResize.onChange = function () {
                stResizeValue.text = cfg.resize = mathTrunc(this.value) / 10
                stResize.text = cfg.resize != 1 ? s + ' ' + (mathTrunc((b.width * cfg.resize) / 8) * 8) + 'x' + (mathTrunc((b.height * cfg.resize) / 8) * 8) : s
            }
            slResize.onChanging = function () { slResize.onChange() }
            slResize.addEventListener('keydown', commonHandler)
            function commonHandler(evt) {
                if (evt.shiftKey) {
                    if (evt.keyIdentifier == 'Right' || evt.keyIdentifier == 'Up') {
                        slResize.value = Math.floor(slResize.value / 5) * 5 + 4
                    } else if (evt.keyIdentifier == 'Left' || evt.keyIdentifier == 'Down') {
                        slResize.value = Math.ceil(slResize.value / 5) * 5 - 4
                    }
                }
            }
        }
        function denoisingStrength(w) {
            var grStrength = w.add("group");
            grStrength.orientation = "column";
            grStrength.alignChildren = ["fill", "top"];
            grStrength.spacing = 0;
            grStrength.margins = 0;
            var grStrengthTitle = grStrength.add("group");
            grStrengthTitle.orientation = "row";
            grStrengthTitle.alignChildren = ["left", "center"];
            grStrengthTitle.spacing = 10;
            grStrengthTitle.margins = 0;
            var stStrength = grStrengthTitle.add("statictext");
            stStrength.text = "Denoising strength";
            stStrength.preferredSize.width = 220;
            var stStrengthValue = grStrengthTitle.add("statictext");
            stStrengthValue.justify = "right";
            stStrengthValue.preferredSize.width = 65
            stStrengthValue.graphics.foregroundColor = stStrengthValue.graphics.newPen(stStrengthValue.graphics.PenType.SOLID_COLOR, [0.48, 0.76, 0.34, 1], 1)
            var slStrength = grStrength.add("slider");
            slStrength.minvalue = 0;
            slStrength.maxvalue = 100;
            slStrength.value = cfg.denoising_strength * 100
            stStrengthValue.text = cfg.denoising_strength
            slStrength.active = true
            slStrength.onChange = function () {
                stStrengthValue.text = cfg.denoising_strength = mathTrunc(this.value) / 100
            }
            slStrength.onChanging = function () { slStrength.onChange() }
            slStrength.addEventListener('keydown', commonHandler)
            function commonHandler(evt) {
                if (evt.shiftKey) {
                    if (evt.keyIdentifier == 'Right' || evt.keyIdentifier == 'Up') {
                        slStrength.value = Math.floor(slStrength.value / 5) * 5 + 4
                    } else if (evt.keyIdentifier == 'Left' || evt.keyIdentifier == 'Down') {
                        slStrength.value = Math.ceil(slStrength.value / 5) * 5 - 4
                    }
                }
            }
        }
    }
    function settingsWindow(p, cfg) {
        var w = new Window("dialog");
        w.text = "Sctipt settings";
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing = 10;
        w.margins = 16;
        var chFlatten = w.add("checkbox");
        chFlatten.text = "flatten layers before generation";
        chFlatten.value = cfg.flatten
        chFlatten.onClick = function () { cfg.flatten = this.value }
        var pnPathSettings = w.add("panel");
        pnPathSettings.text = "Output";
        pnPathSettings.orientation = "column";
        pnPathSettings.alignChildren = ["fill", "top"];
        pnPathSettings.spacing = 5;
        pnPathSettings.margins = 10;
        var grPath = pnPathSettings.add("group");
        grPath.orientation = "column";
        grPath.alignChildren = ["left", "center"];
        grPath.spacing = 5;
        grPath.margins = 0;
        var etPath = grPath.add('edittext {properties: {readonly: true, multiline: true}}');
        etPath.preferredSize.width = 250;
        etPath.preferredSize.height = 40;
        etPath.text = (new File(SD['data_dir'] + '/' + SD['outdir_img2img_samples'])).fsName
        var chRemove = pnPathSettings.add("checkbox");
        chRemove.text = "remove image after placing";
        chRemove.value = cfg.removeImage
        chRemove.onClick = function () { cfg.removeImage = this.value }
        var chRasterize = pnPathSettings.add("checkbox");
        chRasterize.text = "rasterize placed image";
        chRasterize.value = cfg.rasterizeImage
        chRasterize.onClick = function () { cfg.rasterizeImage = this.value }
        var pnShow = w.add("panel");
        pnShow.text = "Show items";
        pnShow.orientation = "column";
        pnShow.alignChildren = ["left", "top"];
        pnShow.spacing = 0;
        pnShow.margins = 10;
        var chCheckpoint = pnShow.add("checkbox");
        chCheckpoint.text = "Stable Diffusion checkpoint";
        chCheckpoint.value = cfg.showSd_model_checkpoint
        chCheckpoint.onClick = function () { cfg.showSd_model_checkpoint = this.value }
        var chVae = pnShow.add("checkbox");
        chVae.text = "SD VAE";
        chVae.value = cfg.showSd_vae
        chVae.onClick = function () { cfg.showSd_vae = this.value }
        var chPrompt = pnShow.add("checkbox");
        chPrompt.text = "Prompt";
        chPrompt.value = cfg.showPrompt
        chPrompt.onClick = function () { cfg.showPrompt = this.value }
        var chNegative = pnShow.add("checkbox");
        chNegative.text = "Negative prompt";
        chNegative.value = cfg.showNegative_prompt
        chNegative.onClick = function () { cfg.showNegative_prompt = this.value }
        var chSampling = pnShow.add("checkbox");
        chSampling.text = "Sampling method";
        chSampling.value = cfg.showSampler_name
        chSampling.onClick = function () { cfg.showSampler_name = this.value }
        var chSheldule = pnShow.add("checkbox");
        chSheldule.text = "Schedule type";
        chSheldule.value = cfg.showScheduler
        chSheldule.onClick = function () { cfg.showScheduler = this.value }
        var chSteps = pnShow.add("checkbox");
        chSteps.text = "Sampling steps";
        chSteps.value = cfg.showSteps
        chSteps.onClick = function () { cfg.showSteps = this.value }
        var chCfg = pnShow.add("checkbox");
        chCfg.text = "CFG Scale";
        chCfg.value = cfg.showCfg_scale
        chCfg.onClick = function () { cfg.showCfg_scale = this.value }
        var chResize = pnShow.add("checkbox");
        chResize.text = "Resize by scale";
        chResize.value = cfg.showResize
        chResize.onClick = function () { cfg.showResize = this.value }
        var pnBrush = w.add("panel");
        pnBrush.text = "Brush settings";
        pnBrush.orientation = "column";
        pnBrush.alignChildren = ["fill", "top"];
        pnBrush.spacing = 10;
        pnBrush.margins = 10;
        var chSelectBrush = pnBrush.add("checkbox");
        chSelectBrush.text = "Select brush after processing";
        chSelectBrush.value = cfg.selectBrush
        chSelectBrush.onClick = function () {
            cfg.selectBrush = this.value
        }
        var grOpacity = pnBrush.add("group");
        grOpacity.orientation = "column";
        grOpacity.alignChildren = ["fill", "center"];
        grOpacity.spacing = 5;
        grOpacity.margins = 0;
        var grOpacityTitle = grOpacity.add("group");
        grOpacityTitle.orientation = "row";
        grOpacityTitle.alignChildren = ["left", "center"];
        grOpacityTitle.spacing = 10;
        grOpacityTitle.margins = 0;
        var stOpacityTitke = grOpacityTitle.add("statictext");
        stOpacityTitke.text = "Brush opacity";
        stOpacityTitke.preferredSize.width = 150;
        var stOpacityValue = grOpacityTitle.add("statictext");
        stOpacityValue.preferredSize.width = 65;
        stOpacityValue.justify = "right";
        var slOpacity = grOpacity.add("slider");
        slOpacity.minvalue = 0;
        slOpacity.maxvalue = 100;
        slOpacity.active = true
        stOpacityValue.graphics.foregroundColor = stOpacityValue.graphics.newPen(stOpacityValue.graphics.PenType.SOLID_COLOR, [0.48, 0.76, 0.34, 1], 1)
        slOpacity.value = stOpacityValue.text = cfg.brushOpacity
        slOpacity.onChange = function () {
            stOpacityValue.text = cfg.brushOpacity = mathTrunc(this.value)
        }
        slOpacity.onChanging = function () { slOpacity.onChange() }
        slOpacity.addEventListener('keydown', commonHandler)
        function commonHandler(evt) {
            if (evt.shiftKey) {
                if (evt.keyIdentifier == 'Right' || evt.keyIdentifier == 'Up') {
                    slOpacity.value = Math.floor(slOpacity.value / 5) * 5 + 4
                } else if (evt.keyIdentifier == 'Left' || evt.keyIdentifier == 'Down') {
                    slOpacity.value = Math.ceil(slOpacity.value / 5) * 5 - 4
                }
            }
        }
        var chRecordSettings = w.add("checkbox");
        chRecordSettings.text = "Do not record generation settings to action";
        chRecordSettings.value = !cfg.recordToAction
        chRecordSettings.onClick = function () {
            cfg.recordToAction = !this.value
        }
        var grBn = w.add("group");
        grBn.orientation = "row";
        grBn.alignChildren = ["center", "center"];
        grBn.spacing = 10;
        grBn.margins = [0, 10, 0, 0];
        var ok = grBn.add("button", undefined, undefined, { name: "ok" });
        ok.text = "Apply settings";
        return w
    }
}
function mathTrunc(val) {
    return val < 0 ? Math.ceil(val) : Math.floor(val);
}
function cloneObject(o1, o2) {
    var tmp = o1.reflect.properties;
    for (a in tmp) {
        var k = tmp[a].name.toString();
        if (k == "__proto__" || k == "__count__" || k == "__class__" || k == "reflect") continue;
        o2[k] = o1[k]
    }
}
function checkSelection() {
    if (apl.getProperty('numberOfDocuments')) {
        if (doc.hasProperty('quickMask')) doc.clearQuickMask();
        if (lr.getProperty('name') == LAYER_NAME && lr.getProperty('hasUserMask') && !doc.hasProperty('selection')) {
            lr.selectUserMask()
            doc.makeSelectionFromLayer('targetEnum');
            targetID = lr.getProperty('layerID');
        }
        if (doc.hasProperty('selection')) {
            if (!targetID) {
                doc.makeLayer(LAYER_NAME)
                doc.makeSelectionMask()
                doc.makeSelectionFromLayer('targetEnum');
                targetID = lr.getProperty('layerID');
                cleanup = true;
            }
            var b = doc.descToObject(doc.getProperty('selection').value),
                w = Math.round((b.right - b.left) / 8) * 8,
                h = Math.round((b.bottom - b.top) / 8) * 8;
            if (w != (b.right - b.left) || h != (b.bottom - b.top)) {
                b.bottom = b.top + h;
                b.right = b.left + w;
            }
            b.width = b.right - b.left
            b.height = b.bottom - b.top
            return b
        }
    }
    return null
}
function findSDChannel(title) {
    var idx = 1;
    do {
        try { if (ch.getProperty('channelName', false, idx++, true) == title) return idx - 1 } catch (e) { return 0 }
    } while (true)
}
function SDApi(host, sdPort, portSend, portListen, apiFile) {
    var SdCfg = this;
    this.initialize = function () {
        if (!apiFile.exists)
            throw new Error('Модуль sd-webui-api\n' + apiFile.fsName + '\nне найден!')
        if (!checkConnecton(host + ':' + sdPort))
            throw new Error('Невозможно установить соединение c ' + host + ':' + sdPort + '\nStable Diffusion не отвечает!')
        apiFile.execute();
        if (!checkConnecton(host + ':' + portSend))
            throw new Error('Невозможно установить соединение c ' + host + ':' + portSend + '\nМодуль sd-webui-api не отвечает!')
        var result = sendMessage({ type: "get", message: "sdapi/v1/options" }, true);
        if (result) {
            SdCfg['outdir_img2img_samples'] = result['outdir_img2img_samples']
            SdCfg['sd_model_checkpoint'] = result['sd_model_checkpoint']
            SdCfg['sd_vae'] = result['sd_vae']
        } else { throw new Error('Невозможно получить параметры sdapi/v1/options\nПревышено время ожидания ответа!') }
        var result = sendMessage({ type: "get", message: "sdapi/v1/sd-models" }, true);
        if (result) {
            SdCfg['sd-models'] = []
            if (!result.length) throw new Error('Список sdapi/v1/sd-models пуст!\nНеобходимо добавить хотя бы одну модель в Stable Diffusion')
            for (var i = 0; i < result.length; i++) SdCfg['sd-models'].push(result[i].title)
        } else { throw new Error('Невозможно получить параметры sdapi/v1/sd-models\nПревышено время ожидания ответа!') }
        var vaes = ['sdapi/v1/sd-vae', 'sdapi/v1/sd-modules']
        var result = sendMessage({ type: "get", message: cfg.vae }, true);
        if (!result) {
            cfg.vae = (cfg.vae == vaes[0] ? vaes[1] : vaes[0])
            result = sendMessage({ type: "get", message: cfg.vae }, true)
        }
        if (result) {
            SdCfg['sd-vaes'] = []
            SdCfg['sd-vaes'].push("Automatic")
            SdCfg['sd-vaes'].push("None")
            for (var i = 0; i < result.length; i++) SdCfg['sd-vaes'].push(result[i].model_name)
        } else { throw new Error('Невозможно получить параметры ' + cfg.vae + '\nПревышено время ожидания ответа!') }
        var result = sendMessage({ type: "get", message: "sdapi/v1/schedulers" }, true);
        if (result) {
            SdCfg['schedulers'] = []
            if (!result.length) throw new Error('Список sdapi/v1/schedulers пуст!\nНеобходимо добавить хотя бы один планировщик в Stable Diffusion')
            for (var i = 0; i < result.length; i++) SdCfg['schedulers'].push(result[i].label)
        } else { throw new Error('Невозможно получить параметры sdapi/v1/schedulers\nПревышено время ожидания ответа!') }
        var result = sendMessage({ type: "get", message: "sdapi/v1/samplers" }, true);
        if (result) {
            SdCfg['samplers'] = []
            if (!result.length) throw new Error('Список sdapi/v1/samplers пуст!\nНеобходимо добавить хотя бы один сэмплер в Stable Diffusion')
            for (var i = 0; i < result.length; i++) SdCfg['samplers'].push(result[i].name)
        } else { throw new Error('Невозможно получить параметры sdapi/v1/samplers\nПревышено время ожидания ответа!') }
        var result = sendMessage({ type: "get", message: "sdapi/v1/cmd-flags" }, true);
        if (result) {
            SdCfg['data_dir'] = result['data_dir']
        } else { throw new Error('Невозможно получить параметры sdapi/v1/cmd-flags\nПревышено время ожидания ответа!') }
        return true
    }
    this.exit = function () {
        sendMessage({ type: "exit" })
    }
    this.setOptions = function (checkpoint, vae) {
        if (sendMessage({ type: "update", message: { sd_model_checkpoint: checkpoint, sd_vae: vae } }, true, SD_RELOAD_CHECKPOINT_DELAY)) return true
        return false;
    }
    this.sendPayload = function (payload) {
        var result = sendMessage({ type: "payload", message: payload }, true, SD_GENERATION_DELAY)
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
        tcp.open(host + ':' + portSend, "UTF-8")
        tcp.writeln(objectToJSON(o))
        tcp.close()
        if (getAnswer) {
            var t1 = (new Date).getTime(),
                t2 = 0;
            var tcp = new Socket;
            if (tcp.listen(portListen, "UTF-8")) {
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
        t2s = typeIDToStringID;
    target = target ? s2t(target) : null;
    this.getProperty = function (property, descMode, id, idxMode) {
        property = s2t(property);
        (r = new ActionReference()).putProperty(s2t('property'), property);
        id != undefined ? (idxMode ? r.putIndex(target, id) : r.putIdentifier(target, id)) :
            r.putEnumerated(target, s2t('ordinal'), order ? s2t(order) : s2t('targetEnum'));
        return descMode ? executeActionGet(r) : getDescValue(executeActionGet(r), property);
    }
    this.hasProperty = function (property, id, idxMode) {
        property = s2t(property);
        (r = new ActionReference()).putProperty(s2t('property'), property);
        id ? (idxMode ? r.putIndex(target, id) : r.putIdentifier(target, id))
            : r.putEnumerated(target, s2t('ordinal'), s2t('targetEnum'));
        try { return executeActionGet(r).hasKey(property) } catch (e) { return false }
    }
    this.setProperty = function (property, desc) {
        property = s2t(property);
        (r = new ActionReference()).putProperty(s2t('property'), property);
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
    this.flatten = function () { executeAction(s2t("flattenImage"), undefined, DialogModes.NO); }
    this.saveACopy = function (pth) {
        (d1 = new ActionDescriptor()).putInteger(s2t("extendedQuality"), 12);
        d1.putEnumerated(s2t("matteColor"), s2t("matteColor"), s2t("none"));
        (d = new ActionDescriptor()).putObject(s2t("as"), s2t("JPEG"), d1);
        d.putPath(s2t("in"), pth);
        d.putBoolean(s2t("copy"), true);
        executeAction(s2t("save"), d, DialogModes.NO);
    }
    this.makeSelection = function (top, left, bottom, right) {
        (r = new ActionReference()).putProperty(s2t('channel'), s2t('selection'));
        (d = new ActionDescriptor()).putReference(s2t('null'), r);
        (d1 = new ActionDescriptor()).putUnitDouble(s2t('top'), s2t('pixelsUnit'), top);
        d1.putUnitDouble(s2t('left'), s2t('pixelsUnit'), left);
        d1.putUnitDouble(s2t('bottom'), s2t('pixelsUnit'), bottom);
        d1.putUnitDouble(s2t('right'), s2t('pixelsUnit'), right);
        d.putObject(s2t('to'), s2t('rectangle'), d1);
        executeAction(s2t('set'), d, DialogModes.NO);
    }
    this.deleteLayer = function (id) {
        (r = new ActionReference()).putIdentifier(s2t("layer"), id);
        (d = new ActionDescriptor()).putReference(s2t('null'), r);
        executeAction(s2t('delete'), d, DialogModes.NO);
    }
    this.makeSelectionFromLayer = function (targetEnum, id) {
        (r = new ActionReference()).putProperty(s2t('channel'), s2t('selection'));
        (d = new ActionDescriptor()).putReference(s2t('null'), r);
        (r1 = new ActionReference()).putEnumerated(s2t('channel'), s2t('channel'), s2t(targetEnum));
        if (id) r1.putIdentifier(s2t("layer"), id);
        d.putReference(s2t('to'), r1);
        executeAction(s2t('set'), d, DialogModes.NO);
    }
    this.selectBrush = function () {
        (r = new ActionReference()).putClass(s2t("paintbrushTool"));
        (d = new ActionDescriptor()).putReference(s2t("null"), r);
        executeAction(s2t("select"), d, DialogModes.NO);
    }
    this.setBrushOpacity = function (opacity) {
        (r = new ActionReference()).putProperty(s2t('property'), p = s2t('currentToolOptions'));
        r.putEnumerated(s2t('application'), s2t('ordinal'), s2t('targetEnum'));
        var tool = executeActionGet(r).getObjectValue(p);
        tool.putInteger(s2t('opacity'), opacity);
        (r = new ActionReference()).putClass(s2t(currentTool));
        (d = new ActionDescriptor()).putReference(s2t("target"), r);
        d.putObject(s2t("to"), s2t("target"), tool);
        executeAction(s2t("set"), d, DialogModes.NO);
    }
    this.resetSwatches = function () {
        (r = new ActionReference()).putProperty(s2t("color"), s2t("colors"));
        (d = new ActionDescriptor()).putReference(s2t("null"), r);
        executeAction(s2t("reset"), d, DialogModes.NO);
    }
    this.selectUserMask = function () {
        (r = new ActionReference()).putEnumerated(s2t("channel"), s2t("channel"), s2t("mask"));
        (d = new ActionDescriptor()).putReference(s2t("null"), r);
        executeAction(s2t("select"), d, DialogModes.NO);
    }
    this.clearQuickMask = function () {
        (r = new ActionReference()).putProperty(s2t("property"), s2t("quickMask"));
        r.putEnumerated(s2t("document"), s2t("ordinal"), s2t("targetEnum"));
        (d = new ActionDescriptor()).putReference(s2t("null"), r);
        executeAction(s2t("clearEvent"), d, DialogModes.NO);
    }
    this.crop = function (deletePixels) {
        (d = new ActionDescriptor()).putBoolean(s2t("delete"), deletePixels);
        executeAction(s2t("crop"), d, DialogModes.NO);
    }
    this.selectLayersByIDList = function (IDList) {
        (d = new ActionDescriptor()).putReference(s2t("null"), IDList)
        executeAction(s2t("select"), d, DialogModes.NO)
    }
    this.hideSelectedLayers = function () {
        (r = new ActionReference()).putEnumerated(s2t("layer"), s2t("ordinal"), s2t("targetEnum"));
        (l = new ActionList()).putReference(r);
        (d = new ActionDescriptor()).putList(s2t("null"), l);
        executeAction(s2t("hide"), d, DialogModes.NO);
    }
    this.setName = function (title) {
        (r = new ActionReference()).putEnumerated(s2t("layer"), s2t("ordinal"), s2t("targetEnum"));
        (d = new ActionDescriptor()).putReference(s2t("null"), r);
        (d1 = new ActionDescriptor()).putString(s2t("name"), title);
        d.putObject(s2t("to"), s2t("layer"), d1);
        executeAction(s2t("set"), d, DialogModes.NO);
    }
    this.place = function (pth) {
        var descriptor = new ActionDescriptor();
        descriptor.putPath(s2t("null"), pth);
        descriptor.putBoolean(s2t("linked"), false);
        executeAction(s2t("placeEvent"), descriptor, DialogModes.NO);
    }
    this.rasterize = function () {
        (d = new ActionDescriptor()).putReference(s2t('target'), r);
        executeAction(s2t('rasterizePlaced'), d, DialogModes.NO);
    }
    this.makeSelectionMask = function () {
        (d = new ActionDescriptor()).putClass(s2t("new"), s2t("channel"));
        (r = new ActionReference()).putEnumerated(s2t("channel"), s2t("channel"), s2t("mask"));
        d.putReference(s2t("at"), r);
        d.putEnumerated(s2t("using"), s2t("userMask"), s2t("revealSelection"));
        executeAction(s2t("make"), d, DialogModes.NO);
    }
    this.transform = function (dw, dh) {
        (d = new ActionDescriptor()).putEnumerated(s2t("freeTransformCenterState"), s2t("quadCenterState"), s2t("QCSAverage"));
        (d1 = new ActionDescriptor()).putUnitDouble(s2t("horizontal"), s2t("pixelsUnit"), 0);
        d1.putUnitDouble(s2t("vertical"), s2t("pixelsUnit"), 0);
        d.putObject(s2t("offset"), s2t("offset"), d1);
        d.putUnitDouble(s2t("width"), s2t("percentUnit"), dw);
        d.putUnitDouble(s2t("height"), s2t("percentUnit"), dh);
        executeAction(s2t("transform"), d, DialogModes.NO);
    }
    this.makeLayer = function (title) {
        (r = new ActionReference()).putClass(s2t("layer"));
        (d = new ActionDescriptor()).putReference(s2t("null"), r);
        (d1 = new ActionDescriptor()).putString(s2t("name"), title)
        d.putObject(s2t("using"), s2t("layer"), d1);
        executeAction(s2t("make"), d, DialogModes.NO);
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
    this.dialogMode = true
    this.sd_model_checkpoint = ""
    this.sd_vae = "Automatic"
    this.scheduler = "Automatic"
    this.sampler_name = "DPM++ 2M"
    this.cfg_scale = 7
    this.steps = 20
    this.denoising_strength = 0.22
    this.prompt = ""
    this.negative_prompt = "(deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, (mutated hands and fingers:1.4), disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation"
    this.resize = 1
    this.flatten = false
    this.removeImage = true
    this.rasterizeImage = true
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
    this.vae = 'sdapi/v1/sd-vae'
    settingsObj = this;
    this.getScriptSettings = function (fromAction) {
        if (fromAction) d = playbackParameters else try { var d = getCustomOptions(UUID) } catch (e) { };
        if (d != undefined) descriptorToObject(settingsObj, d)
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
                }
            }
        }
    }
    this.putScriptSettings = function (toAction) {
        var d = objectToDescriptor(settingsObj, UUID)
        if (toAction) playbackParameters = d else putCustomOptions(UUID, d, true);
        function objectToDescriptor(o) {
            var d = new ActionDescriptor;
            var l = o.reflect.properties.length;
            for (var i = 0; i < l; i++) {
                var k = o.reflect.properties[i].toString();
                if (k == "__proto__" || k == "__count__" || k == "__class__" || k == "reflect") continue;
                var v = o[k];
                k = app.stringIDToTypeID(k);
                switch (typeof (v)) {
                    case "boolean": d.putBoolean(k, v); break;
                    case "string": d.putString(k, v); break;
                    case "number": d.putDouble(k, v); break;
                }
            }
            return d;
        }
    }
}
