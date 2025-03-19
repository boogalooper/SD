#target photoshop
/*
// BEGIN__HARVEST_EXCEPTION_ZSTRING
<javascriptresource> 
<name>SD - generated image to layer</name> 
<eventid>55a8fbbe-9b5e-4a82-8601-1921bcd61edd</eventid>
</javascriptresource>
// END__HARVEST_EXCEPTION_ZSTRING
*/
const SD_Output = 'c:\\Users\\Dmitry\\stable-diffusion-webui\\outputs',
    BRUSH_OPACITY = 50,
    LAYER_NAME = "SD generated image";
var doc = new AM('document'),
    lr = new AM('layer'),
    apl = new AM('application'),
    ch = new AM('channel'),
    s2t = stringIDToTypeID,
    t2s = typeIDToStringID,
    runMode = false;

if (apl.getProperty('numberOfDocuments')) activeDocument.suspendHistory('Paste generated image', 'main()')
function main() {
    try { runMode = (d = app.playbackParameters).getBoolean(d.getKey(0)) } catch (e) { }
    var currentChannel = findSDChannel(LAYER_NAME);
    if (doc.hasProperty('selection') || currentChannel) {
        var pth = browseFolder(new Folder(SD_Output));
        if (pth.length) {
            pth.sort(function (x, y) {
                return x.time < y.time ? 1 : -1
            });
            if (currentChannel && !doc.hasProperty('selection')) doc.channelToSelection(currentChannel)
            var bounds = doc.descToObject(doc.getProperty('selection').value);
            doc.place(pth[0].file)
            var placedBounds = doc.descToObject(lr.getProperty('bounds').value);
            var dW = (bounds.right - bounds.left) / (placedBounds.right - placedBounds.left);
            var dH = (bounds.bottom - bounds.top) / (placedBounds.bottom - placedBounds.top)
            lr.transform(dW * 100, dH * 100);
            lr.rasterize();
            if (currentChannel) {
                doc.channelToSelection(currentChannel)
                doc.makeSelectionMask()
                doc.deleteChannel(currentChannel)
            } else {
                lr.makeMask(true);
            }
            lr.setName(LAYER_NAME)
            doc.resetSwatches()
            doc.selectBrush();
            doc.setBrushOpacity(BRUSH_OPACITY)
            pth[0].file.remove();
        }
    }
}

function findAllFiles(srcFolder, fileObj, useSubfolders) {
    if (!srcFolder) return
    var fileFolderArray = Folder(srcFolder).getFiles(),
        subfolderArray = [];
    for (var i = 0; i < fileFolderArray.length; i++) {
        var fileFoldObj = fileFolderArray[i];
        if (fileFoldObj instanceof File) {
            if (!fileFoldObj.hidden) fileObj.push(
                {
                    file: fileFoldObj,
                    time: fileFoldObj.created.getTime()
                }
            )
        } else if (useSubfolders) {
            subfolderArray.push(fileFoldObj)
        }
    }
    if (useSubfolders) {
        for (var i = 0; i < subfolderArray.length; i++) findAllFiles(subfolderArray[i], fileObj, useSubfolders)
    }
}
function browseFolder(fol) {
    if (!fol) fol = (new Folder()).selectDlg()
    if (fol) {
        if (fol.exists) {
            var pth = [];
            findAllFiles(fol, pth, true)
            return pth
        }
    }
}
function findSDChannel(title) {
    var idx = 1;
    do {
        try { if (ch.getProperty('channelName', false, idx++, true) == title) return idx - 1 } catch (e) { return 0 }
    } while (true)
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
    this.descToObject = function (d) {
        var o = {}
        for (var i = 0; i < d.count; i++) {
            var k = d.getKey(i)
            o[t2s(k)] = getDescValue(d, k)
        }
        return o
    }
    this.selectLayers = function (IDList) {
        var r = new ActionReference()
        for (var i = 0; i < IDList.length; i++) {
            r.putIdentifier(s2t("layer"), IDList[i])
        }
        (d = new ActionDescriptor()).putReference(s2t("target"), r)
        d.putBoolean(s2t("makeVisible"), false)
        executeAction(s2t("select"), d, DialogModes.NO)
    }
    this.place = function (pth) {
        var descriptor = new ActionDescriptor();
        descriptor.putPath(s2t("null"), pth);
        descriptor.putBoolean(s2t("linked"), true);
        executeAction(s2t("placeEvent"), descriptor, DialogModes.NO);
    }
    this.channelToSelection = function (idx) {
        (r = new ActionReference()).putProperty(s2t("channel"), s2t("selection"));
        (d = new ActionDescriptor()).putReference(s2t("null"), r);
        (r1 = new ActionReference()).putIndex(s2t("channel"), idx);
        d.putReference(s2t("to"), r1);
        executeAction(s2t("set"), d, DialogModes.NO);
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
    this.makeMask = function (hide) {
        var mode = hide ? 'revealAll' : 'hideAll';
        (d = new ActionDescriptor()).putClass(s2t("new"), s2t("channel"));
        (r = new ActionReference()).putEnumerated(s2t("channel"), s2t("channel"), s2t("mask"));
        d.putReference(s2t("at"), r);
        d.putEnumerated(s2t("using"), s2t("userMask"), s2t(mode));
        executeAction(s2t("make"), d, DialogModes.NO);
    }
    this.setName = function (title) {
        (r = new ActionReference()).putEnumerated(s2t("layer"), s2t("ordinal"), s2t("targetEnum"));
        (d = new ActionDescriptor()).putReference(s2t("null"), r);
        (d1 = new ActionDescriptor()).putString(s2t("name"), title);
        d.putObject(s2t("to"), s2t("layer"), d1);
        executeAction(s2t("set"), d, DialogModes.NO);
    }
    this.rasterize = function () {
        (d = new ActionDescriptor()).putReference(s2t('target'), r);
        executeAction(s2t('rasterizePlaced'), d, DialogModes.NO);
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
    this.exchangeSwatches = function () {
        (r = new ActionReference()).putProperty(s2t("color"), s2t("colors"));
        (d = new ActionDescriptor()).putReference(s2t("null"), r);
        executeAction(s2t("exchange"), d, DialogModes.NO);
    }
    this.deleteChannel = function (idx) {
        (r = new ActionReference()).putIndex(s2t("channel"), idx);
        (d = new ActionDescriptor()).putReference(s2t("null"), r);
        executeAction(s2t("delete"), d, DialogModes.NO);
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
