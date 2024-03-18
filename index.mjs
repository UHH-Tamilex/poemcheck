import { alignWordsplits } from './lib/debugging/aligner.mjs';
import { Sanscript } from './lib/js/sanscript.mjs';
import makeAlignmentTable from './lib/debugging/alignmenttable.mjs';
import { showSaveFilePicker } from 'https://cdn.jsdelivr.net/npm/native-file-system-adapter/mod.js';

const _state = {
    standOff: null,
    poem: null
};

const alignCheck = async () => {
    const output = document.getElementById('alignment');
    output.innerHTML = '';
    const wordlist = document.getElementById('wordlist');
    wordlist.innerHTML = '';

    const warnings = document.getElementById('errors');
    warnings.innerHTML = '';

    const inputs = document.querySelectorAll('textarea');
    const tamval = Sanscript.t(inputs[1].value.replaceAll(/[\d∞\[\]]/g,'').trim(),'tamil','iast');
    const tamlines = tamval.replaceAll(/[,.;?!](?=\s|$)/g,'').split(/\n+/);
    const tam = tamlines.reduce((acc,cur) => acc.concat(cur.trim().split(/\s+/)),[]);

    const engval = inputs[2].value.trim();
    const eng = engval ? engval.split(/\s+/)
                               .map(s => s.trim().replaceAll('∞','').replaceAll(/[,.;?!]$/g,''))
                               .filter(s => !s.match(/^\d+$/)) :
                         Array(tam.length).fill('');
    if(engval) {
        const englines = engval.split(/\n+/).map(s => s.replace(/[\s\d]+$/,''));
        for(let n=0;n<tamlines.length;n++) {
            if(!englines[n]) {
                warnings.innerHTML = (`<div><b>Line ${n+1}</b>: Word split & word-by-word translation don't match.</div>`);
                warnings.style.border = '1px dotted red';
                warnings.style.padding = '1rem';
                return;
            }
            if(tamlines[n].trim().split(/\s+/).length !== englines[n].trim().split(/\s+/).length) {
                
                warnings.innerHTML = (`<div><b>Line ${n+1}</b>: Tamil & English don't match.</div>`);
                warnings.style.border = '1px dotted red';
                warnings.style.padding = '1rem';
                return;
            }
        }
    }

    warnings.style.border = 'none';

    const iasted = Sanscript.t(inputs[0].value.trim(),'tamil','iast');
    const text = iasted.replaceAll(/[\s\d\[\]]/g,'');

    const lookup = document.querySelector('input[name="lookup"]').checked;

    const ret = await alignWordsplits(text,tam,eng,lookup);
    
    if(ret.warnings.length > 0) {
        for(const warning of ret.warnings) {
            const ws = document.createElement('div');
            ws.innerHTML = `<b>${ret.warnings}</b> not recognized.`;
            warnings.append(ws);
        }
        warnings.style.border = '1px dotted red';
        warnings.style.padding = '1rem';
    }

    makeAlignmentTable(ret.alignment,tamlines,output);
    
    if(lookup) inputs[2].value = refreshTranslation(tamlines,ret.wordlist);

    const parser = new DOMParser();
    const standOff = parser.parseFromString(`<standOff xmlns="http://www.tei-c.org/ns/1.0" type="wordsplit">\n${ret.xml}\n</standOff>`,'text/xml');
    
    _state.standOff = `<standOff type="wordsplit">${ret.xml}</standOff>`;
    _state.poem = formatPoem(iasted,inputs);

    const xproc = new XSLTProcessor();
    const resp = await fetch('wordlist.xsl');
    const xslsheet =  parser.parseFromString(await resp.text(),'text/xml');
    xproc.importStylesheet(xslsheet);
    wordlist.append(xproc.transformToDocument(standOff).firstChild);
    const tds = wordlist.querySelectorAll('td span');
    for(const td of [...tds].reverse()) {
        td.focus();
        td.blur();
    }
    document.getElementById('savebutton').style.display = 'inline';
};

const refreshTranslation = (lines,wordlist) => {
    let ret = '';
    const makeWord = (obj) => {
        let trans = obj.translation;
        if(obj.gram && obj.gram.length > 0)
            trans = trans + '(' + obj.gram.join('|') + ')';
        if(trans === '') trans = '()';
        return trans;
    };

    let w = 0;
    for(const line of lines) {
        const wordsinline = line.trim().split(/\s+/).length;
        for(let n=0;n<wordsinline;n++) {
            ret = ret + makeWord(wordlist[w]) + ' ';
            w = w + 1;
        }
        ret = ret + '\n';
    }
    return ret;
};

const formatPoem = (str,inputs) => {
    const lines = str.replaceAll('[','<supplied>')
                     .replaceAll(']','</supplied>')
                     .split(/\n/)
                     .map(l => `<l>${l}</l>`);
    const puttuvil = (inputs[1].value.includes('∞') || inputs[2].value.includes('∞')) ?
        ' style="pūṭṭuvil"' : '';
    return `<text xml:lang="ta">\n  <body>\n    <div>\n      <lg type="edition"${puttuvil}>\n${lines.join('\n')}</lg>\n    </div>\n  </body>\n</text>`;
};

const saveAs = async () => {
    const text = `<?xml version="1.0" encoding="UTF-8"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0">\n${_state.poem}\n${_state.standOff}\n</TEI>`;
    const file = new Blob([text],{type: 'text/xml;charset=utf-8'});
    const fileHandle = await showSaveFilePicker({
        _preferPolyfill: false,
        suggestedName: 'poem.xml',
        types: [{description: 'TEI XML', accept: {'text/xml': ['.xml']} }]
    });
    const writer = await fileHandle.createWritable();
    writer.write(file);
    writer.close();

};

window.addEventListener('load',() => {
    document.getElementById('alignbutton').addEventListener('click',alignCheck);
    document.getElementById('savebutton').addEventListener('click',saveAs);
});
