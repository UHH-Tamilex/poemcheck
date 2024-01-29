import { alignWordsplits } from './lib/debugging/aligner.mjs';
import { Sanscript } from './lib/js/sanscript.mjs';
import makeAlignmentTable from './lib/debugging/alignmenttable.mjs';

const alignCheck = async () => {
    const output = document.getElementById('alignment');
    output.innerHTML = '';
    const wordlist = document.getElementById('wordlist');
    wordlist.innerHTML = '';

    const warnings = document.getElementById('errors');
    warnings.innerHTML = '';

    const inputs = document.querySelectorAll('textarea');
    const tamval = Sanscript.t(inputs[1].value.replaceAll(/[\d∞]/g,'').trim(),'tamil','iast');
    const tamlines = tamval.replaceAll(/[,.;?!](?=\s|$)/g,'').split(/\n+/);
    const tam = tamlines.reduce((acc,cur) => acc.concat(cur.trim().split(/\s+/)),[]);

    const engval = inputs[2].value.trim();
    const eng = engval ? engval.split(/\s+/)
                               .map(s => s.replaceAll(/[,.;?!]$/g,''))
                               .filter(s => !s.match(/^\d+$/)) :
                         Array(tam.length).fill('');
    if(engval) {
        const englines = engval.split(/\n+/).map(s => s.replace(/\s+\d+$/,''));
        for(let n=0;n<tamlines.length;n++) {
            if(tamlines[n].trim().split(/\s+/).length !== englines[n].trim().split(/\s+/).length) {
                
                warnings.innerHTML = (`<div><b>Line ${n+1}</b>: Tamil & English don't match.</div>`);
                warnings.style.border = '1px dotted red';
                warnings.style.padding = '1rem';
                return;
            }
        }
    }

    warnings.style.border = 'none';

    const text = Sanscript.t(inputs[0].value.trim(),'tamil','iast').replaceAll(/[\s\d]/g,'');

    const lookup = document.querySelector('input[name="lookup"]').checked;

    const ret = await alignWordsplits(text,tam,eng,lookup);

    makeAlignmentTable(ret.alignment,tamlines,output);
    
    if(lookup) inputs[2].value = refreshTranslation(tamlines,ret.wordlist);

    const parser = new DOMParser();
    const standOff = parser.parseFromString(`<standOff xmlns="http://www.tei-c.org/ns/1.0" type="wordsplit">\n${ret.xml}\n</standOff>`,'text/xml');
    const xproc = new XSLTProcessor();
    const resp = await fetch('wordlist.xsl');
    const xslsheet =  parser.parseFromString(await resp.text(),'text/xml');
    xproc.importStylesheet(xslsheet);
    wordlist.append(xproc.transformToDocument(standOff).firstChild);
};

const refreshTranslation = (lines,wordlist) => {
    let ret = '';
    const makeWord = (obj) => {
        let trans = obj.translation;
        if(obj.gram && obj.gram.length > 0)
            trans = trans + '(' + obj.gram.join('') + ')';
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

window.addEventListener('load',() => {
    document.getElementById('align').querySelector('button').addEventListener('click',alignCheck);
});
