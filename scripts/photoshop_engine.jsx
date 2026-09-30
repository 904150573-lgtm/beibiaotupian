/* Photoshop ExtendScript label job v3. Run only the generated self-contained job. */
(function () {
    var labelJob = /*__INLINE_JOB__*/null;
    if (!labelJob || !labelJob.products || !labelJob.template) {
        alert('未载入产品数据。请运行生成的完整“背标出图”脚本，勿单独运行引擎文件。');
        return;
    }
    var cfg=labelJob.config, layout=cfg.layout;
    var oldUnits = app.preferences.rulerUnits, oldDialogs = app.displayDialogs;
    var results = [], active = null, output = null, source = null, copy = null;
    /*__TYPE_HELPERS__*/
    function fail(s) { throw new Error(s); }
    function resolvePath(p) { return String(p).replace(/^~(?=\/|$)/,Folder('~').fsName); }
    function clean(s) { return String(s).replace(/[\r\n\u0000]/g, ''); }
    function walk(container, map) {
        for (var i=0;i<container.layers.length;i++) {
            var l=container.layers[i]; map[l.id]=l;
            if(l.typename==='LayerSet') walk(l,map);
        }
    }
    function box(l) { var b=l.bounds; return [b[0].as('px'),b[1].as('px'),b[2].as('px'),b[3].as('px')]; }
    function move(l,x,y) { var b=box(l); l.translate(UnitValue(x-b[0],'px'),UnitValue(y-b[1],'px')); }
    function fontExists(name) {
        for(var i=0;i<app.fonts.length;i++) if(app.fonts[i].postScriptName===name) return true;
        return false;
    }
    function wrap(l, text, width, originalSnapshot) {
        // Preserve original kind, justification, leading, scale and mixed tracking.
        if(l.textItem.kind!==TextType.POINTTEXT) fail('模板文字类型已变化，需重新适配：'+l.name);
        var snapshot=originalSnapshot || typeSnapshot(l);
        var lines=[], line='', chars=String(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n');
        for(var i=0;i<chars.length;i++) {
            var c=chars.charAt(i);
            if(c==='\n') { lines.push(line);line='';continue; }
            setStyledText(l,lines.concat([line+c]).join('\r'),snapshot,false);
            var b=box(l);
            if(b[2]-b[0]>width && line.length) { lines.push(line);line=c; }
            else line+=c;
        }
        lines.push(line);setStyledText(l,lines.join('\r'),snapshot,true);
        var finalBox=box(l);
        if(finalBox[2]-finalBox[0]>width+1) fail('文字超出栏宽：'+text);
        if(clean(l.textItem.contents)!==clean(text)) fail('文字校验失败：'+text);
    }
    function centreText(l,text,cx,top,maxWidth,maxBottom) {
        setStyledText(l,text,typeSnapshot(l),true);
        var b=box(l); move(l,cx-(b[2]-b[0])/2,top);b=box(l);
        if(b[2]-b[0]>maxWidth || b[3]>maxBottom) fail('营养表文字超出范围：'+l.name);
        if(clean(l.textItem.contents)!==clean(text)) fail('营养表文字校验失败');
    }
    function safe(s) { return s.replace(/[\/:*?"<>|\r\n]/g,'_'); }
    function writeReport() {
        if(!output) return;
        var f=new File(output.fsName+'/运行报告.txt');f.encoding='UTF8';
        if(f.open('w')) { f.write(results.join('\n\n'));f.close(); }
    }
    try {
        app.preferences.rulerUnits=Units.PIXELS;
        var template=new File(resolvePath(cfg.template.path));
        if(!template.exists) template=File.openDialog('请选择桌面的背标模版 PSD');
        if(!template) return;
        if(!/\.psd$/i.test(template.name)) fail('请选择 PSD 文件。');
        if(labelJob.templateByteSize && template.length!==labelJob.templateByteSize)
            fail('模板文件大小与映射版本不同，请确认使用“参数模版(3).psd”，或重新检查模板并更新配置。');
        var outputRoot=new Folder(resolvePath(cfg.output.directory));
        if(!outputRoot.exists) fail('输出父目录不存在：'+outputRoot.fsName);
        output=new Folder(outputRoot.fsName+'/'+safe(cfg.output.prefix)+'_'+new Date().getTime());
        if(!output.create()) fail('无法创建输出文件夹。');
        // Open a file copy so the desktop template and any open document remain untouched.
        copy=new File(output.fsName+'/_模板副本.psd');
        if(!template.copy(copy.fsName)) fail('无法复制模板。');
        source=app.open(copy);var map={};walk(source,map);
        if(source.width.as('px')!==labelJob.width || source.height.as('px')!==labelJob.height) {
            source.close(SaveOptions.DONOTSAVECHANGES);fail('模板尺寸已变化，需重新检查映射。');
        }
        var missing=[];
        for(var k=0;k<labelJob.template.length;k++) {
            var entry=labelJob.template[k], layer=map[entry.id];
            if(!layer || layer.typename!=='ArtLayer' || layer.kind!==LayerKind.TEXT || clean(layer.textItem.contents)!==clean(entry.text)) {
                source.close(SaveOptions.DONOTSAVECHANGES);fail('模板图层已变化：'+entry.name+'。请上传新模板重新适配。');
            }
            var fn=layer.textItem.font;
            if(!fontExists(fn) && missing.join('|').indexOf(fn)<0) missing.push(fn);
        }
        // Check the expected branded fonts even if Photoshop substituted one at open.
        for(var fi=0;fi<cfg.template.required_fonts.length;fi++) {
            if(!fontExists(cfg.template.required_fonts[fi])) missing.push(cfg.template.required_fonts[fi]);
        }
        if(missing.length) { source.close(SaveOptions.DONOTSAVECHANGES);fail('缺少模板字体：'+missing.join('、')+'。请安装字体后重试。'); }
        app.displayDialogs=DialogModes.NO;
        for(var pi=0;pi<labelJob.products.length;pi++) {
            var product=labelJob.products[pi];
            var psdWritten=false;
            try {
                active=source.duplicate(product.name,false);app.activeDocument=active;
                map={};walk(active,map);
                var originalStyles={};
                for(var mi in map) {
                    if(map.hasOwnProperty(mi) && map[mi].typename==='ArtLayer' && map[mi].kind===LayerKind.TEXT) originalStyles[mi]=typeSnapshot(map[mi]);
                }
                var rows=layout.rows;
                var cursor=layout.start_y;
                for(var ri=0;ri<rows.length;ri++) {
                    var row=rows[ri],value=product.fields[row.field],label,valueLayer;
                    if(row.duplicate) {
                        if(!value) continue;
                        label=map[row.label_id].duplicate();valueLayer=map[row.value_id].duplicate();
                        label.name=row.field;valueLayer.name=row.field+'内容';
                    } else { label=map[row.label_id];valueLayer=map[row.value_id]; }
                    if(!value || !/\S/.test(value)) { label.visible=false;valueLayer.visible=false;continue; }
                    label.visible=true;valueLayer.visible=true;
                    var labelText=row.field==='贮存方法'?'储存条件':row.field;
                    if(label.textItem.contents!==labelText) setStyledText(label,labelText,originalStyles[row.label_id],true);
                    wrap(valueLayer,value,layout.value_width,originalStyles[row.value_id]);
                    move(label,layout.label_x,cursor);move(valueLayer,layout.value_x,cursor);
                    cursor=Math.max(box(label)[3],box(valueLayer)[3])+layout.row_gap;
                }
                if(cursor-layout.row_gap>layout.max_bottom) fail('文字总高度超出模板，未缩小字号或截断文字。需调整版式。');
                var n=layout.nutrition;
                function nutritionText(id,text,b) { centreText(map[id],text,b[0],b[1],b[2],b[3]); }
                nutritionText(n.names_id,'能量\r蛋白质\r脂肪\r—饱和脂肪\r碳水化合物\r—糖\r钠',n.names_box);
                nutritionText(n.amounts_id,product.amounts,n.amounts_box);
                nutritionText(n.nrv_id,product.percentages,n.nrv_box);
                nutritionText(n.basis_id,product.basis,n.basis_box);
                var base=output.fsName+'/'+(pi+1)+'_'+safe(product.name);
                if(cfg.output.save_psd) {
                    var psdOptions=new PhotoshopSaveOptions();psdOptions.layers=true;
                    active.saveAs(new File(base+'.psd'),psdOptions,true,Extension.LOWERCASE);
                    psdWritten=true;
                }
                // Flatten only the working copy before producing an sRGB JPEG.
                active.flatten();
                if(active.mode!==DocumentMode.RGB) active.changeMode(ChangeMode.RGB);
                active.bitsPerChannel=BitsPerChannelType.EIGHT;
                active.convertProfile('sRGB IEC61966-2.1',Intent.RELATIVECOLORIMETRIC,true,true);
                var jpgOptions=new JPEGSaveOptions();jpgOptions.quality=cfg.output.jpeg_quality;jpgOptions.embedColorProfile=true;
                jpgOptions.formatOptions=FormatOptions.STANDARDBASELINE;
                active.saveAs(new File(base+'.jpg'),jpgOptions,true,Extension.LOWERCASE);
                results.push('已导出：'+product.name+'\n'+product.warnings.join('\n'));
            } catch(productError) { results.push('失败：'+product.name+'\n'+productError.message+(psdWritten?'\nPSD 已保存，但 JPG 尚未成功导出。':'')); }
            finally { if(active) { active.close(SaveOptions.DONOTSAVECHANGES);active=null; } }
        }
        source.close(SaveOptions.DONOTSAVECHANGES);source=null;copy.remove();writeReport();
        alert(results.join('\n\n')+'\n\n输出位置：'+output.fsName+'\n请首次检查换行及营养表对齐。');
    } catch(error) { results.push('已停止（v3）：'+error.message+'\n脚本行号：'+(error.line || '未知'));writeReport();alert(results.join('\n\n')); }
    finally {
        if(source) { try { source.close(SaveOptions.DONOTSAVECHANGES); } catch(ignore) {} }
        if(copy && copy.exists) { try { copy.remove(); } catch(ignoreCopy) {} }
        app.preferences.rulerUnits=oldUnits;app.displayDialogs=oldDialogs;
    }
})();
