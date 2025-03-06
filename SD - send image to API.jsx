#target photoshop
/*
// BEGIN__HARVEST_EXCEPTION_ZSTRING
<javascriptresource> 
<name>SD - send image to API</name> 
<eventid>32190faf-82e5-495b-918a-1f52d3029ec1</eventid>
<terminology><![CDATA[<< /Version 1
                        /Events <<
                        /32190faf-82e5-495b-918a-1f52d3029ec1 [(SD - send image to API) <<
                        /strength [(Strength) /double]
                        >>]
                         >>
                      >> ]]></terminology>
</javascriptresource>
// END__HARVEST_EXCEPTION_ZSTRING
*/
const SD_OUTPUT = 'c:\\Users\\Dmitry\\stable-diffusion-webui\\outputs\\img2img-images',
    UUID = '32190faf-82e5-495b-918a-1f52d3029ec1',
    FLATTEN_LAYERS = false;
var s2t = stringIDToTypeID,
    t2s = typeIDToStringID,
    apl = new AM('application'),
    doc = new AM('document'),
    lr = new AM('layer'),
    cfg = new Config(),
    isCancelled = false;
init();
isCancelled ? 'cancel' : undefined
function init() {
    var b = getSelectionBounds();
    if (!app.playbackParameters.count || app.playbackParameters.count == 1) {
        cfg.getScriptSettings();
        if (app.playbackParameters.count == 1) cfg.dialogMode = true
        if (cfg.dialogMode && b) {
            var w = dialogWindow(b); var result = w.show()
            if (result == 2) {
                isCancelled = true;
                return;
            } else {
                cfg.dialogMode = false;
                cfg.putScriptSettings(true)
                cfg.putScriptSettings()
                main(b)
            }
        } else {
            if (b) {
                cfg.putScriptSettings(true)
                main(b)
            } else {
                isCancelled = true
            }
        }
    }
    else {
        cfg.getScriptSettings(true)
        if (app.playbackDisplayDialogs == DialogModes.ALL) {
            var w = dialogWindow(b); var result = w.show()
            if (result == 2) {
                isCancelled = true;
                return;
            } else {
                if (b) main(b)
                cfg.putScriptSettings(true)
            }
        } else {
            if (b) main(b)
        }
    }
}
function main(bounds) {
    var sdApiConnector = new File(File($.fileName).path + '/sd-webui-api.pyw')
    if (sdApiConnector.exists) {
        if (lr.getProperty('name') == 'SD' & lr.getProperty('hasUserMask')) doc.deleteCurrentLayer()
        var hst = activeDocument.activeHistoryState,
            c = doc.getProperty('center').value;
        doc.crop(true);
        if (FLATTEN_LAYERS) { doc.flatten() } else {
            var len = doc.getProperty('numberOfLayers'),
                start = lr.getProperty('itemIndex'),
                lrsList = new ActionReference();
            offset = doc.getProperty('hasBackgroundLayer') ? 0 : 1;
            for (var i = start + offset; i <= len; i++) lrsList.putIdentifier(s2t("layer"), lr.getProperty('layerID', false, i, true));
            if (start + offset <= len) {
                doc.selectLayerByIDList(lrsList);
                doc.hideSelectedLayers();
            }
        }
        var f = new File(Folder.temp + '/SDH.jpg');
        doc.saveACopy(f);
        activeDocument.activeHistoryState = hst;
        doc.setProperty('center', c);
        activeDocument.suspendHistory('Generate image', 'function(){}')
        fl = File(Folder.temp + '/SD_vbs_init.vbs')
        fl.open("w");
        fl.encoding = "text";
        fl.writeln('Set WshShell = CreateObject("WScript.Shell")')
        fl.writeln('WshShell.Run """' + sdApiConnector.fsName + '"" ""' + f.fsName.replace(/\\/, '\\\\') + '"" ' + '""' + SD_OUTPUT + '"" ' + bounds.width + ' ' + bounds.height + ' ' + cfg.strength + '"')
        fl.close()
        fl.execute()
        $.sleep(300)
        fl.remove()
    } else { alert('Not Found:\n\n' + sdApiConnector.fsName, 'Error', true) }
}
function getSelectionBounds() {
    if (apl.getProperty('numberOfDocuments')) {
        if (lr.getProperty('name') == 'SD' & lr.getProperty('hasUserMask')) doc.makeSelectionFromChannel();
        if (doc.hasProperty('quickMask')) doc.clearQuickMask();
        if (doc.hasProperty('selection')) {
            var b = doc.descToObject(doc.getProperty('selection').value),
                w = Math.round((b.right - b.left) / 8) * 8,
                h = Math.round((b.bottom - b.top) / 8) * 8;
            if (w != (b.right - b.left) || h != (b.bottom - b.top)) {
                b.bottom = b.top + h;
                b.right = b.left + w;
                doc.makeSelection(b.top, b.left, b.bottom, b.right);
            }
            b.width = b.right - b.left
            b.height = b.bottom - b.top
            return b
        }
    }
    return null
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
    this.deleteCurrentLayer = function () {
        (r = new ActionReference()).putEnumerated(s2t('layer'), s2t('ordinal'), s2t('targetEnum'));
        (d = new ActionDescriptor()).putReference(s2t('null'), r);
        executeAction(s2t('delete'), d, DialogModes.NO);
    }
    this.makeSelectionFromChannel = function () {
        (r = new ActionReference()).putProperty(s2t('channel'), s2t('selection'));
        (d = new ActionDescriptor()).putReference(s2t('null'), r);
        (r1 = new ActionReference()).putEnumerated(s2t('channel'), s2t('channel'), s2t("transparencyEnum"));
        d.putReference(s2t('to'), r1);
        executeAction(s2t('set'), d, DialogModes.NO);
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
    this.selectLayerByIDList = function (IDList) {
        (d = new ActionDescriptor()).putReference(s2t("null"), IDList)
        executeAction(s2t("select"), d, DialogModes.NO)
    }
    this.hideSelectedLayers = function () {
        (r = new ActionReference()).putEnumerated(s2t("layer"), s2t("ordinal"), s2t("targetEnum"));
        (l = new ActionList()).putReference(r);
        (d = new ActionDescriptor()).putList(s2t("null"), l);
        executeAction(s2t("hide"), d, DialogModes.NO);
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
function dialogWindow(bounds) {
    var w = new Window("dialog {text: 'Set SD strength',alignChildren:['fill','top']}"),
        text = w.add('statictext'),
        slider = w.add("slider {minvalue:0, maxvalue:100, value:" + cfg.strength * 100 + ", preferredSize:[250,-1] }"),
        g = w.add("group {alignChildren:['center', 'center']}"),
        bnOk = g.add("button {text:'Ok'}", undefined, undefined, { name: 'ok' });
    slider.active = true;
    slider.onChange = function () {
        bnOk.text = cfg.strength = Math.round(this.value) / 100
    }
    slider.onChanging = function () { slider.onChange() }

    slider.addEventListener('keydown', commonHandler)

    function commonHandler(evt) {
        if (evt.shiftKey) {
            if (evt.keyIdentifier == 'Right' || evt.keyIdentifier == 'Up') {
                slider.value = Math.round(slider.value / 5) * 5 + 4
            } else if (evt.keyIdentifier == 'Left' || evt.keyIdentifier == 'Down') {
                slider.value = Math.round(slider.value / 5) * 5 - 4
            }

        }
    }
    w.onShow = function () {
        bnOk.text = cfg.strength
        if (bounds) text.text = 'Selection size: ' + bounds.width + 'x' + bounds.height
    }
    return w;
}
function Config() {
    this.strength = 0.2
    this.dialogMode = true
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
        if (toAction) playbackParameters = d else putCustomOptions(UUID, d, false);
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
