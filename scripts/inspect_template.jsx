#target photoshop
/* Inventory only. Does not edit or save the PSD. */
(function () {
    if(!app.documents.length) { alert('请先打开要检查的 PSD。'); return; }
    var doc=app.activeDocument, records=[];
    function quote(s) {
        return '"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"')
            .replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\t/g,'\\t')+'"';
    }
    function walk(c) {
        for(var i=0;i<c.layers.length;i++) {
            var l=c.layers[i];
            if(l.typename==='LayerSet') walk(l);
            else if(l.kind===LayerKind.TEXT)
                records.push('{"id":'+l.id+',"name":'+quote(l.name)+',"text":'+quote(l.textItem.contents)+'}');
        }
    }
    walk(doc);
    var f=File.saveDialog('保存文字图层映射（JSON）');
    if(!f) return;
    f.encoding='UTF8';
    if(!f.open('w')) { alert('无法写入映射文件'); return; }
    f.write('[\n'+records.join(',\n')+'\n]');f.close();
    alert('已记录 '+records.length+' 个文字图层。请核对 config.json 中的图层 ID、尺寸和布局参数。\n宽高：'+doc.width.as('px')+' × '+doc.height.as('px'));
})();
