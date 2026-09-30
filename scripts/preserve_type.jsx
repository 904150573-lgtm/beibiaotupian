/* Keep the template's per-line, per-character style, including mixed tracking. */
function typeKey(layer) {
    var r=new ActionReference();
    r.putProperty(stringIDToTypeID('property'),stringIDToTypeID('textKey'));
    r.putIdentifier(stringIDToTypeID('layer'),layer.id);
    return executeActionGet(r).getObjectValue(stringIDToTypeID('textKey'));
}
function typeSnapshot(layer) {
    var d=typeKey(layer);
    return {descriptor:d,text:d.getString(stringIDToTypeID('textKey'))};
}
function sourceOffsets(oldText,newText) {
    var oldLines=oldText.split('\r'),starts=[],offset=0,out=[],line=0,column=0;
    // Ignore the host's terminal paragraph marker as an extra content line.
    if(oldLines.length>1 && oldLines[oldLines.length-1]==='') oldLines.pop();
    for(var i=0;i<oldLines.length;i++) { starts.push(offset);offset+=oldLines[i].length+1; }
    for(var j=0;j<=newText.length;j++) {
        var li=Math.min(line,oldLines.length-1);
        out.push(starts[li]+Math.min(column,Math.max(0,oldLines[li].length-1)));
        if(newText.charAt(j)==='\r') { line++;column=0; } else column++;
    }
    return out;
}
function rangeAt(list,index) {
    var from=stringIDToTypeID('from'),to=stringIDToTypeID('to');
    for(var i=0;i<list.count;i++) {
        var d=list.getObjectValue(i);
        if(d.getInteger(from)<=index && index<d.getInteger(to)) return i;
    }
    return list.count-1;
}
function remapTypeRanges(list,offsets,paragraph,text) {
    var out=new ActionList(),begin=0,last=-1;
    function emit(end) {
        var d=new ActionDescriptor();d.fromStream(list.getObjectValue(last).toStream());
        d.putInteger(stringIDToTypeID('from'),begin);d.putInteger(stringIDToTypeID('to'),end);
        out.putObject(list.getObjectType(last),d);
    }
    for(var i=0;i<offsets.length;i++) {
        var which=rangeAt(list,offsets[i]);
        if(paragraph && i>0 && text.charAt(i-1)!=='\r') which=last;
        if(which!==last) { if(last>=0) emit(i);begin=i;last=which; }
    }
    if(last>=0) emit(offsets.length);
    return out;
}
function numericStyle(d,key) {
    var k=stringIDToTypeID(key);
    if(!d.hasKey(k)) return null;
    var t=d.getType(k);
    if(t===DescValueType.INTEGERTYPE) return d.getInteger(k);
    if(t===DescValueType.DOUBLETYPE) return d.getDouble(k);
    if(t===DescValueType.UNITDOUBLE) return d.getUnitDoubleValue(k);
    return null;
}
function kerningRangeAt(list,index) {
    for(var i=0;i<list.count;i++) {
        var d=list.getObjectValue(i);
        if(d.getInteger(stringIDToTypeID('from'))<=index && index<d.getInteger(stringIDToTypeID('to'))) return i;
    }
    return -1;
}
function remapKerning(list,offsets,text) {
    var out=new ActionList();
    for(var i=0;i<text.length;i++) {
        if(text.charAt(i)==='\r') continue;
        var which=kerningRangeAt(list,offsets[i]);
        if(which<0) continue;
        var d=new ActionDescriptor();d.fromStream(list.getObjectValue(which).toStream());
        d.putInteger(stringIDToTypeID('from'),i);d.putInteger(stringIDToTypeID('to'),i+1);
        out.putObject(list.getObjectType(which),d);
    }
    return out;
}
function kerningValue(list,index) {
    var i=kerningRangeAt(list,index);
    return i<0?0:numericStyle(list.getObjectValue(i),'kerning');
}
function styleToken(d,key) {
    var k=stringIDToTypeID(key);
    if(!d.hasKey(k)) return null;
    var t=d.getType(k);
    if(t===DescValueType.BOOLEANTYPE) return 'b:'+d.getBoolean(k);
    if(t===DescValueType.ENUMERATEDTYPE) return 'e:'+d.getEnumerationType(k)+':'+d.getEnumerationValue(k);
    if(t===DescValueType.STRINGTYPE) return 's:'+d.getString(k);
    return null;
}
function setStyledText(layer,text,snapshot,verify) {
    // Set text, then restore original style ranges against the new string.
    // Read current geometry so this never restores a stale position after moving.
    layer.textItem.contents=text;
    var d=typeKey(layer),offsets=sourceOffsets(snapshot.text,text);
    var fields=['textStyleRange','paragraphStyleRange'];
    for(var i=0;i<fields.length;i++) {
        var k=stringIDToTypeID(fields[i]);
        if(!snapshot.descriptor.hasKey(k)) throw Error('模板缺少文字样式：'+layer.name);
        d.putList(k,remapTypeRanges(snapshot.descriptor.getList(k),offsets,i===1,text));
    }
    var kk=stringIDToTypeID('kerningRange');
    var originalKerning=snapshot.descriptor.hasKey(kk)?snapshot.descriptor.getList(kk):new ActionList();
    d.putList(kk,remapKerning(originalKerning,offsets,text));
    var action=new ActionDescriptor(),ref=new ActionReference();
    ref.putIdentifier(stringIDToTypeID('layer'),layer.id);
    action.putReference(stringIDToTypeID('null'),ref);
    action.putObject(stringIDToTypeID('to'),stringIDToTypeID('textLayer'),d);
    executeAction(stringIDToTypeID('set'),action,DialogModes.NO);
    if(verify) {
        var readback=typeKey(layer);
        var actual=readback.getList(stringIDToTypeID('textStyleRange'));
        var expected=d.getList(stringIDToTypeID('textStyleRange'));
        var keys=['tracking','size','leading','horizontalScale','verticalScale'];
        var tokens=['autoLeading','autoKern','fontPostScriptName'];
        var actualKerning=readback.hasKey(kk)?readback.getList(kk):new ActionList();
        var expectedKerning=d.getList(kk);
        for(var pos=0;pos<text.length;pos++) {
            var a=actual.getObjectValue(rangeAt(actual,pos)).getObjectValue(stringIDToTypeID('textStyle'));
            var e=expected.getObjectValue(rangeAt(expected,pos)).getObjectValue(stringIDToTypeID('textStyle'));
            for(var ki=0;ki<keys.length;ki++) {
                var ev=numericStyle(e,keys[ki]),av=numericStyle(a,keys[ki]);
                if(ev!==null && (av===null || Math.abs(ev-av)>0.0001))
                    throw Error('模板字距/字号/行距校验不符：'+layer.name+'，'+keys[ki]);
            }
            for(var ti=0;ti<tokens.length;ti++) {
                var token=styleToken(e,tokens[ti]);
                if(token!==null && token!==styleToken(a,tokens[ti]))
                    throw Error('模板字体/自动行距/字偶距模式校验不符：'+layer.name+'，'+tokens[ti]);
            }
            if(kerningValue(actualKerning,pos)!==kerningValue(expectedKerning,pos))
                throw Error('模板字符对间距校验不符：'+layer.name);
        }
        var ap=readback.getList(stringIDToTypeID('paragraphStyleRange'));
        var ep=d.getList(stringIDToTypeID('paragraphStyleRange'));
        for(var pp=0;pp<text.length;pp++) {
            if(pp>0 && text.charAt(pp-1)!=='\r') continue;
            var pa=ap.getObjectValue(rangeAt(ap,pp)).getObjectValue(stringIDToTypeID('paragraphStyle'));
            var pe=ep.getObjectValue(rangeAt(ep,pp)).getObjectValue(stringIDToTypeID('paragraphStyle'));
            var align=styleToken(pe,'align');
            if(align!==null && align!==styleToken(pa,'align'))
                throw Error('模板段落对齐校验不符：'+layer.name);
        }
    }
}
