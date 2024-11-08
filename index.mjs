import { alignWordsplits } from './lib/debugging/aligner.mjs';
import { Sanscript } from './lib/js/sanscript.mjs';
import makeAlignmentTable from './lib/debugging/alignmenttable.mjs';
import { showSaveFilePicker } from './lib/js/native-file-system-adapter/es6.js';

const _state = {
    standOff: null,
    poem: null,
    tamlines: null,
    wordlist: null,
    taTaml: (new URLSearchParams(window.location.search)).get('script') === 'Taml'
};

const alignCheck = async () => {
    const blackout = document.createElement('div');
    blackout.id = 'blackout';
    blackout.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(blackout);
    
    _state.poemid = document.getElementById('poemid').value || 'poemXX';

    const output = document.getElementById('alignment');
    output.innerHTML = '';
    const wordlistel = document.getElementById('wordlist');
    wordlistel.innerHTML = '';

    const warnings = document.getElementById('errors');
    warnings.innerHTML = '';

    const inputs = document.querySelectorAll('textarea');
    const tamval = Sanscript.t(inputs[1].value.replaceAll(/[\d∞\[\]]/g,'').trim(),'tamil','iast');
    const tamlines = tamval.replaceAll(/[,.;?!](?=\s|$)/g,'')
                           .replaceAll(/u\*/g,'*')
                           .split(/\n+/);
    _state.tamlines = tamlines;

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
                blackout.remove();
                return;
            }
            if(tamlines[n].trim().split(/\s+/).length !== englines[n].trim().split(/\s+/).length) {
                
                warnings.innerHTML = (`<div><b>Line ${n+1}</b>: Tamil & English don't match.</div>`);
                warnings.style.border = '1px dotted red';
                warnings.style.padding = '1rem';
                blackout.remove();
                return;
            }
        }
    }

    warnings.style.border = 'none';

    const iasted = Sanscript.t(inputs[0].value.trim(),'tamil','iast');
    const text = iasted.replaceAll(/[\s\d\[\]]/g,'');

    const lookup = document.querySelector('input[name="lookup"]').checked;

    const ret = await alignWordsplits(text,tam,eng,[],lookup);
   
    _state.wordlist = ret.wordlist;

    const tables = makeAlignmentTable(ret.alignment,tamlines.map(l => l.replaceAll(/\/.+?(?=\s|$)/g,'')),ret.warnings);
    output.append(...tables); 

    if(lookup) inputs[2].value = refreshTranslation(tamlines,_state.wordlist);

    const parser = new DOMParser();
    const standOff = parser.parseFromString(`<standOff xmlns="http://www.tei-c.org/ns/1.0" type="wordsplit">\n${ret.xml}\n</standOff>`,'text/xml');
    
    _state.standOff = `<standOff type="wordsplit" corresp="#${_state.poemid}">${ret.xml}</standOff>`;
    _state.poem = formatPoem(iasted,inputs);

    const xproc = new XSLTProcessor();
    const resp = await fetch('lib/debugging/wordlist.xsl');
    const xslsheet =  parser.parseFromString(await resp.text(),'text/xml');
    xproc.importStylesheet(xslsheet);
    const res = xproc.transformToDocument(standOff).firstChild;
    
    if(_state.taTaml)
        for(const th of res.querySelectorAll('[lang="ta-Latn"]')) {
            th.textContent = Sanscript.t(th.textContent,'iast','tamil');
            th.lang = 'ta-Taml';
        }

    wordlistel.append(res);
    const tds = wordlistel.querySelectorAll('td span');
    for(const td of [...tds].reverse()) {
        td.focus();
        td.blur();
    }
    document.getElementById('savebutton').style.display = 'inline';
    document.getElementById('savebutton').disabled = false;
    document.getElementById('savebutton').title = '';
    blackout.remove();
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
                     .replaceAll(/\d/g,'')
                     .split(/\n/)
                     .map(l => `<l>${l.trim()}</l>`);
    const puttuvil = (inputs[1].value.includes('∞') || inputs[2].value.includes('∞')) ?
        ' style="pūṭṭuvil"' : '';
    return `<text xml:lang="ta">\n  <body>\n    <div xml:id="${_state.poemid}">\n      <lg type="edition"${puttuvil}>\n${lines.join('\n')}\n</lg>\n    </div>\n  </body>\n</text>`;
};

const saveAs = async () => {
    const text = 
`<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="edition.xsl" ?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>
            <title xml:lang="ta"></title> XX.
            <persName xml:lang="ta"></persName>
        </title>     
      </titleStmt>
      <publicationStmt><p/></publicationStmt>
      <sourceDesc>
        <msDesc xml:lang="en">
          <msIdentifier>
          </msIdentifier>
           <msContents>
            <summary><p></p>
            </summary>
          </msContents>    
        </msDesc>
      </sourceDesc>
    </fileDesc>
    <revisionDesc><change/></revisionDesc>
  </teiHeader>
${_state.poem}
${_state.standOff}
</TEI>`;
    const file = new Blob([text],{type: 'text/xml;charset=utf-8'});
    const fileHandle = await showSaveFilePicker({
        _preferPolyfill: false,
        suggestedName: `${_state.poemid}.xml`,
        types: [{description: 'TEI XML', accept: {'text/xml': ['.xml']} }]
    });
    const writer = await fileHandle.createWritable();
    writer.write(file);
    writer.close();

};

const refreshFromWordlist = e => {
    document.getElementById('savebutton').disabled = true;
    document.getElementById('savebutton').title = 'Realign first';
    const row = e.target.closest('tr');
    const index = [...row.parentNode.children].indexOf(row);
    _state.wordlist[index].translation = e.target.textContent;
    document.getElementById('engsplit').value = refreshTranslation(_state.tamlines,_state.wordlist);
};

window.addEventListener('load',() => {
    document.getElementById('alignbutton').addEventListener('click',alignCheck);
    document.getElementById('savebutton').addEventListener('click',saveAs);
    document.getElementById('wordlist').addEventListener('input',refreshFromWordlist);
});
