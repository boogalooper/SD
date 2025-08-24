#target photoshop
/*
// BEGIN__HARVEST_EXCEPTION_ZSTRING
<javascriptresource> 
<name>SD face restore</name> 
<eventid>e29b10c8-a069-4e9c-bc6f-426c5ae0f90e</eventid>
<terminology><![CDATA[<< /Version 1
                        /Events <<
                        /e29b10c8-a069-4e9c-bc6f-426c5ae0f90e [(SD face restore) <<
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
    LAYER_NAME = 'SD face restore',
    UUID = 'e29b10c8-a069-4e9c-bc6f-426c5ae0f90e',
    GUID = '7e989ac3-c5ec-4ab8-84eb-eaf051877fdf',
    SD_GET_OPTIONS_DELAY = 2000, // максимальное время ожидания ответа Stable Diffusion при запросе текущих параметров
    SD_RELOAD_CHECKPOINT_DELAY = 10000, // максимальное время ожидания перезагрузки checkpoint или vae
    SD_GENERATION_DELAY = 80000; // максимальное время ожидания генерации изображения
var time = (new Date).getTime(),
    SD = new SDApi(SD_HOST, API_HOST, SD_PORT, API_PORT_SEND, API_PORT_LISTEN, new File((new File($.fileName)).path + '/' + API_FILE)),
    s2t = stringIDToTypeID,
    t2s = typeIDToStringID,
    cfg = new Config(),
    str = new Locale(),
    dl = new Delay(),
    apl = new AM('application'),
    doc = new AM('document'),
    lr = new AM('layer'),
    ch = new AM('channel'),
    ver = 0.123;
isCancelled = false;
$.localize = true
if (ScriptUI.environment.keyboardState.shiftKey) $.setenv('showRestoreDialog', true)
try { init() } catch (e) {
    SD.exit()
    alert(e)
    $.setenv('showRestoreDialog', true)
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
            if (app.playbackParameters.count == 1) $.setenv('showRestoreDialog', true)
            if (($.getenv('showRestoreDialog') == 'true' || $.getenv('showRestoreDialog') == null)) {
                if (SD.initialize()) {
                    var w = dialogWindow(currentSelection.bounds, (((new Date).getTime() - time) / 1000)); var result = w.show()
                    if (result == 2) {
                        SD.exit()
                        isCancelled = true;
                        return;
                    } else if (result != undefined) {
                        $.setenv('showRestoreDialog', false)
                        main(currentSelection)
                        cfg.putScriptSettings()
                        cfg.putScriptSettings(true)
                        SD.exit()
                    }
                }
            } else {
                if (SD.initialize()) {
                    $.setenv('showRestoreDialog', false)
                    main(currentSelection)
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
            if (app.playbackDisplayDialogs == DialogModes.ALL) {
                if (SD.initialize()) {
                    var w = dialogWindow(currentSelection.bounds, (((new Date).getTime() - time) / 1000)); var result = w.show()
                    if (result == 2) {
                        SD.exit()
                        isCancelled = true;
                        return;
                    } else if (result != undefined) {
                        main(currentSelection)
                        cfg.putScriptSettings(true)
                        SD.exit()
                    }
                }
            } else {
                if (SD.initialize()) {
                    main(currentSelection)
                }
                SD.exit()
            }
        }
    }
}
function main(selection) {
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
    if (cfg.flatten) { doc.flatten() } else {
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
    doc.saveACopy(f);
    activeDocument.activeHistoryState = hst;
    doc.setProperty('center', c);
    var p = (new Folder(Folder.temp + '/' + cfg.outdir))
    if (!p.exists) p.create()
    var payload = {
        'input': f.fsName.replace(/\\/g, '\\\\'),
        'output': p.fsName.replace(/\\/g, '\\\\'),
        'gfpgan': cfg.gfpgan,
        'codeformer': cfg.codeFormer,
        'gfpgan_visibility': cfg.gfpganVisiblity,
        'codeformer_visibility': cfg.codeFormerVisiblity,
        'codeformer_weight': cfg.codeFormerWeight
    };
    var result = SD.sendPayload(payload);
    if (result) {
        activeDocument.suspendHistory('Generate image', 'generatedImageToLayer()')
    } else throw new Error(str.errGenerating)
    function generatedImageToLayer() {
        doc.place(new File(result))
        var placedBounds = doc.descToObject(lr.getProperty('bounds').value);
        var dW = (selection.bounds.right - selection.bounds.left) / (placedBounds.right - placedBounds.left);
        var dH = (selection.bounds.bottom - selection.bounds.top) / (placedBounds.bottom - placedBounds.top)
        lr.transform(dW * 100, dH * 100);
        if (cfg.rasterizeImage) { try { lr.rasterize() } catch (e) { } };
        lr.setName(LAYER_NAME)
        doc.makeSelectionFromLayer('mask', selection.junk)
        doc.makeSelectionMask()
        doc.deleteLayer(selection.junk)
        lr.selectChannel('mask');
        if (cfg.selectBrush) {
            doc.resetSwatches()
            doc.selectBrush();
            doc.setBrushOpacity(cfg.brushOpacity)
        }
        (new File(result)).remove();
    }
}
function dialogWindow(b, s) {
    var w = new Window("dialog{orientation:'column',alignChildren:['fill', 'top'],spacing:10,margins:16}"),
        grGlobal = w.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:0,margins:0}"),
        stWH = grGlobal.add("statictext{preferredSize:[260,-1]}"),
        bnSettings = grGlobal.add("button{preferredSize:[25, 25]}"),
        chGFPGAN = w.add("checkbox"),
        grGFPGAN = w.add("group{orientation:'column',alignChildren:['fill', 'top'],spacing:0,margins:0}"),
        grGFPGANTitle = grGFPGAN.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:10,margins:0}"),
        stGFPGAN = grGFPGANTitle.add('statictext{preferredSize:[220,-1]}'),
        stGFPGANValue = grGFPGANTitle.add('statictext{preferredSize:[65,-1],justify:"right"}'),
        slGFPGAN = grGFPGAN.add('slider{minvalue:0,maxvalue:100}'),
        chCodeFormer = w.add("checkbox"),
        grCodeFormer = w.add("group{orientation:'column',alignChildren:['fill', 'top'],spacing:0,margins:0}"),
        grCodeFormerVisiblityTitle = grCodeFormer.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:10,margins:0}"),
        stCodeFormerVisiblity = grCodeFormerVisiblityTitle.add('statictext{preferredSize:[220,-1]}'),
        stCodeFormerVisiblityValue = grCodeFormerVisiblityTitle.add('statictext{preferredSize:[65,-1],justify:"right"}'),
        slCodeFormerVisiblity = grCodeFormer.add('slider{minvalue:0,maxvalue:100}'),
        grCodeFormerWeightTitle = grCodeFormer.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:10,margins:0}"),
        stCodeFormerWeight = grCodeFormerWeightTitle.add('statictext{preferredSize:[220,-1]}'),
        stCodeFormerWeightValue = grCodeFormerWeightTitle.add('statictext{preferredSize:[65,-1],justify:"right"}'),
        slCodeFormerWeight = grCodeFormer.add('slider{minvalue:0,maxvalue:100}'),
        grOk = w.add("group{orientation:'row',alignChildren:['center', 'center'],spacing:10,margins:[0, 10, 0, 0]}"),
        Ok = grOk.add('button', undefined, undefined, { name: 'ok' });
    w.text = 'SD Face restore v.' + ver + ' - responce time ' + s + 's';
    stWH.text = str.selection + b.width + 'x' + b.height;
    bnSettings.text = '⚙';
    chGFPGAN.text = "GFPGAN"
    stGFPGAN.text = "Visibility"
    stGFPGANValue.text = cfg.gfpganVisiblity
    chCodeFormer.text = "CodeFormer"
    stCodeFormerVisiblity.text = "Visibility"
    stCodeFormerVisiblityValue.text = cfg.codeFormerVisiblity
    stCodeFormerWeight.text = "Weight (0 = max effect, 1 = min effect)"
    stCodeFormerWeightValue.text = cfg.codeFormerWeight
    Ok.text = str.generate;
    bnSettings.helpTip = str.settings
    chGFPGAN.value = cfg.gfpgan
    slGFPGAN.value = cfg.gfpganVisiblity * 100
    chGFPGAN.value = cfg.gfpgan
    chCodeFormer.value = cfg.codeFormer
    slCodeFormerVisiblity.value = cfg.codeFormerVisiblity * 100
    chGFPGAN.value = cfg.gfpgan
    slCodeFormerWeight.value = cfg.codeFormerWeight * 100
    chGFPGAN.onClick = function () { cfg.gfpgan = grGFPGAN.enabled = this.value; Ok.enabled = cfg.gfpgan || cfg.codeFormer }
    chCodeFormer.onClick = function () { cfg.codeFormer = grCodeFormer.enabled = this.value; Ok.enabled = cfg.gfpgan || cfg.codeFormer }
    slGFPGAN.onChange = function () { stGFPGANValue.text = cfg.gfpganVisiblity = mathTrunc(this.value) / 100 }
    slGFPGAN.onChanging = function () { slGFPGAN.onChange() }
    slCodeFormerVisiblity.onChange = function () { stCodeFormerVisiblityValue.text = cfg.codeFormerVisiblity = mathTrunc(this.value) / 100 }
    slCodeFormerVisiblity.onChanging = function () { slCodeFormerVisiblity.onChange() }
    slCodeFormerWeight.onChange = function () { stCodeFormerWeightValue.text = cfg.codeFormerWeight = mathTrunc(this.value) / 100 }
    slCodeFormerWeight.onChanging = function () { slCodeFormerWeight.onChange() }
    slGFPGAN.addEventListener('keydown', commonHandler)
    slCodeFormerVisiblity.addEventListener('keydown', commonHandler)
    slCodeFormerWeight.addEventListener('keydown', commonHandler)
    function commonHandler(evt) {
        if (evt.shiftKey) {
            if (evt.keyIdentifier == 'Right' || evt.keyIdentifier == 'Up') {
                evt.target.value = Math.floor(evt.target.value / 5) * 5 + 4
            } else if (evt.keyIdentifier == 'Left' || evt.keyIdentifier == 'Down') {
                evt.target.value = Math.ceil(evt.target.value / 5) * 5 - 4
            }
        }
    }
    bnSettings.onClick = function () {
        var tempSettings = {}
        cloneObject(cfg, tempSettings)
        var s = settingsWindow(w, tempSettings),
            result = s.show();
        if (result == 1) { cloneObject(tempSettings, cfg) }
    }
    return w;
    function settingsWindow(p, cfg) {
        var w = new Window("dialog{orientation:'column',alignChildren:['fill', 'top'],spacing:10,margins:16}"),
            pnPathSettings = w.add("panel{orientation:'column',alignChildren:['fill', 'top'],spacing:5,margins:10}"),
            chFlatten = pnPathSettings.add('checkbox'),
            chRasterize = pnPathSettings.add('checkbox'),
            pnBrush = w.add("panel{orientation:'column',alignChildren:['fill', 'top'],spacing:10,margins:10}"),
            chSelectBrush = pnBrush.add('checkbox'),
            grOpacity = pnBrush.add("group{orientation:'column',alignChildren:['fill', 'center'],spacing:5,margins:0}"),
            grOpacityTitle = grOpacity.add("group{orientation:'row',alignChildren:['left', 'center'],spacing:10,margins:0}"),
            stOpacityTitle = grOpacityTitle.add('statictext{preferredSize:[180,-1]}'),
            stOpacityValue = grOpacityTitle.add('statictext{preferredSize:[65,-1],justify:"right"}'),
            slOpacity = grOpacity.add('slider{minvalue:0,maxvalue:100}'),
            grBn = w.add("group{orientation:'row',alignChildren:['center', 'center'],spacing:10,margins:[0, 10, 0, 0]}"),
            ok = grBn.add('button', undefined, undefined, { name: 'ok' });
        chFlatten.text = str.flatten
        chRasterize.text = str.rasterize
        chSelectBrush.text = str.selctBrush
        ok.text = str.apply
        pnBrush.text = str.brush
        pnPathSettings.text = str.output
        stOpacityTitle.text = str.opacity
        w.text = str.settings
        chFlatten.value = cfg.flatten
        chRasterize.value = cfg.rasterizeImage
        chSelectBrush.value = cfg.selectBrush
        slOpacity.value = stOpacityValue.text = cfg.brushOpacity
        chFlatten.onClick = function () { cfg.flatten = this.value }
        chRasterize.onClick = function () { cfg.rasterizeImage = this.value }
        chSelectBrush.onClick = function () { cfg.selectBrush = this.value }
        slOpacity.onChange = function () { stOpacityValue.text = cfg.brushOpacity = mathTrunc(this.value) }
        slOpacity.onChanging = function () { slOpacity.onChange() }
        slOpacity.addEventListener('keydown', commonHandler)
        function commonHandler(evt) {
            if (evt.shiftKey) {
                if (evt.keyIdentifier == 'Right' || evt.keyIdentifier == 'Up') {
                    evt.target.value = Math.floor(evt.target.value / 5) * 5 + 4
                } else if (evt.keyIdentifier == 'Left' || evt.keyIdentifier == 'Down') {
                    evt.target.value = Math.ceil(evt.target.value / 5) * 5 - 4
                }
            }
        }
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
        if (k == '__proto__' || k == '__count__' || k == '__class__' || k == 'reflect') continue;
        o2[k] = o1[k]
    }
}
function checkSelection(result) {
    if (apl.getProperty('numberOfDocuments')) {
        if (doc.getProperty('quickMask')) {
            doc.quickMask('clearEvent');
            if (doc.hasProperty('selection')) {
                result.result = true
                result.bounds = doc.descToObject(doc.getProperty('selection').value)
            }
            doc.quickMask('set');
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
function SDApi(sdHost, apiHost, sdPort, portSend, portListen, apiFile) {
    var SdCfg = this;
    this.initialize = function (fastMode) {
        if (!apiFile.exists)
            throw new Error(str.module + apiFile.fsName + str.notFound)
        if (!checkConnecton(sdHost + ':' + sdPort))
            throw new Error(str.errConnection + sdHost + ':' + sdPort + '\nStable Diffusion ' + str.errAnswer)
        apiFile.execute();
        var result = sendMessage({ type: 'handshake', message: { sdHost: sdHost, sdPort: sdPort, portSend: portSend, portListen: portListen } }, true);
        if (!result) throw new Error(str.errConnection + apiHost + ':' + portSend + '\n' + str.module + str.errAnswer)
        return true
    }
    this.exit = function () {
        sendMessage({ type: 'exit' })
    }
    this.sendPayload = function (payload) {
        var result = sendMessage({ type: 'faceRestore', message: payload }, true, SD_GENERATION_DELAY, 'Progress', str.progressGenerate, dl.getDelay())
        if (result) return result['message']
        return null;
    }
    function checkConnecton(host) {
        var socket = new Socket,
            answer = socket.open(host);
        socket.close()
        return answer
    }
    function sendMessage(o, getAnswer, delay, title, message, max) {
        var tcp = new Socket,
            delay = delay ? delay : SD_GET_OPTIONS_DELAY;
        tcp.open(apiHost + ':' + portSend, 'UTF-8')
        tcp.writeln(objectToJSON(o))
        tcp.close()
        if (getAnswer) {
            if (title) {
                var w = new Window('palette', title),
                    bar = w.add('progressbar', undefined, 0, max),
                    stProgress = w.add('statictext', undefined, message);
                stProgress.preferredSize = [350, 20];
                stProgress.alignment = 'left'
                bar.preferredSize = [350, 20];
                bar.value = 0;
                w.show();
            }
            var t1 = (new Date).getTime(),
                t2 = 0,
                t3 = t1;
            var tcp = new Socket;
            if (tcp.listen(portListen, 'UTF-8')) {
                for (; ;) {
                    t2 = (new Date).getTime();
                    if (t2 - t1 > delay) {
                        if (title) w.close();
                        return null;
                    }
                    if (title && t2 - t3 > 250) {
                        t3 = t2
                        if (bar.value >= max) bar.value = 0;
                        stProgress.text = message + ' ' + ((t2 - t1) / 1000) + ' s.'
                        bar.value = bar.value + 250;
                        w.update();
                    }
                    var answer = tcp.poll();
                    if (answer != null) {
                        var a = eval('(' + answer.readln() + ')');
                        answer.close();
                        if (title) {
                            dl.saveDelay(t2 - t1)
                            w.close()
                        }
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
        var descriptor = new AD;
        descriptor.putPath(s2t('null'), pth);
        descriptor.putBoolean(s2t('linked'), false);
        executeAction(s2t('placeEvent'), descriptor, DialogModes.NO);
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
    this.gfpgan = true
    this.gfpganVisiblity = 1
    this.codeFormer = true
    this.codeFormerVisiblity = 1
    this.codeFormerWeight = 0
    this.flatten = false
    this.rasterizeImage = true
    this.selectBrush = true
    this.brushOpacity = 60
    this.vae = 'sdapi/v1/sd-vae'
    this.outdir = 'outputs/extras-images'
    var settingsObj = this;
    this.getScriptSettings = function (fromAction) {
        if (fromAction) var d = playbackParameters; else try { var d = getCustomOptions(UUID) } catch (e) { };
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
                if (k == '__proto__' || k == '__count__' || k == '__class__' || k == 'reflect') continue;
                var v = o[k];
                k = app.stringIDToTypeID(k);
                switch (typeof (v)) {
                    case 'boolean': d.putBoolean(k, v); break;
                    case 'string': d.putString(k, v); break;
                    case 'number': d.putDouble(k, v); break;
                }
            }
            return d;
        }
    }
}
function Delay() {
    var settingsObj = this;
    this.getDelay = function () {
        try { var d = getCustomOptions(GUID); } catch (e) { }
        if (d != undefined) descriptorToObject(settingsObj, d);
        if (settingsObj['delay']) {
            var sum = 0;
            for (a in settingsObj['delay']) sum += settingsObj['delay'][a]
            sum = Math.round(sum / settingsObj['delay'].length);
            return sum < 1000 ? 1000 : sum
        } else {
            return 7500
        }
        function descriptorToObject(o, d) {
            var l = d.count;
            for (var i = 0; i < l; i++) {
                var k = d.getKey(i),
                    t = d.getType(k),
                    s = t2s(k);
                switch (t) {
                    case DescValueType.LISTTYPE: o[s] = []; listToArray(d.getList(k), o[s]); break;
                }
            }
            function listToArray(l, a) {
                for (var i = 0; i < l.count; i++) { a.push(l.getInteger(i)) }
            }
        }
    }
    this.saveDelay = function (delay) {
        if (settingsObj['delay'] == undefined) settingsObj['delay'] = [];
        if (settingsObj['delay'].length >= 3) settingsObj['delay'].splice(0, settingsObj['delay'].length - 2)
        settingsObj['delay'].push(delay);
        putCustomOptions(GUID, objectToDescriptor(settingsObj));
        function objectToDescriptor(o) {
            var d = new ActionDescriptor(),
                l = o.reflect.properties.length;
            for (var i = 0; i < l; i++) {
                var k = o.reflect.properties[i].toString();
                if (k == '__proto__' || k == '__count__' || k == '__class__' || k == 'reflect') continue;
                var v = o[k];
                k = s2t(k);
                switch (typeof (v)) {
                    case 'object': if (v instanceof Array) d.putList(k, arrayToList(v, new ActionList())); break;
                }
            }
            return d;
        }
    }
    function arrayToList(a, l) {
        for (var i = 0; i < a.length; i++) { l.putInteger(a[i]) }
        return l
    }
}
function Locale() {
    this.apply = { ru: 'Применить настройки', en: 'Apply settingsa' }
    this.brush = { ru: 'Настройки кисти', en: 'Brush settings' }
    this.errAnswer = { ru: 'не отвечает!', en: 'not answering!' }
    this.errConnection = { ru: 'Невозможно установить соединение c ', en: 'Impossible to establish a connection with ' }
    this.errGenerating = { ru: 'Превышено время ожидания ответа Stable Diffusion!', en: 'Exceeded time waiting for the response of Stable Diffusion!' }
    this.errSettings = { ru: 'Невозможно получить параметры ', en: 'Impossible to get the settings ' }
    this.errTimeout = { ru: '\nПревышено время ожидания ответа!', en: '\nExceeding the response time!' }
    this.fill = 'Inpainting fill mode'
    this.flatten = { ru: 'Склеивать слои перед генерацией', en: 'Flatten layers before generation' }
    this.generate = { ru: 'Генерация', en: 'Generate' }
    this.module = { ru: 'Модуль sd-webui-api ', en: 'Module sd-webui-api ' }
    this.notFound = { ru: '\nне найден!', en: 'not found!' }
    this.opacity = { ru: 'Непрозрачность кисти', en: 'Brush opacity' }
    this.output = { ru: 'Параметры изображения', en: 'Image settings' }
    this.progressGenerate = { ru: 'Генерация изображения...', en: 'Image generation...' }
    this.rasterize = { ru: 'Растеризовать сгенерированное изображение', en: 'Rasterize generated image' }
    this.remove = { ru: 'Удалить файл изображения после вставки', en: 'Remove image file after placing' }
    this.selctBrush = { ru: 'Активировать кисть после генерации', en: 'Select brush after processing' }
    this.selection = { ru: 'Выделение: ', en: 'Selection: ' }
    this.settings = { ru: 'Настройки скрпта', en: 'Script settings' }
}