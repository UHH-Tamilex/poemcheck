import { alignWordsplits } from './lib/debugging/aligner.mjs';
import Splitter from './lib/debugging/splits.mjs';
import { Sanscript } from './lib/js/sanscript.mjs';
import makeAlignmentTable from './lib/debugging/alignmenttable.mjs';
import { showSaveFilePicker } from './lib/js/native-file-system-adapter/es6.js';

const _state = {
    standOff: null,
    poem: null,
    tamlines: null,
    wordlist: null,
    taTaml: (new URLSearchParams(window.location.search)).get('script') === 'Taml',
    editState: null
};

const alignCheck = async () => {
    /*
    const blackout = document.createElement('div');
    blackout.id = 'blackout';
    blackout.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(blackout);
    */
    _state.poemid = document.getElementById('poemid').value || 'poemXX';

    const output = document.getElementById('alignment');
    output.innerHTML = '';
    const wordlistel = document.getElementById('wordlist');
    wordlistel.innerHTML = '';

    const warnings = document.getElementById('errors');
    warnings.innerHTML = '<div class="spinner"></div>';

    const inputs = document.querySelectorAll('textarea');
    const tamval = Sanscript.t(inputs[1].value.replaceAll(/[\d∞]/g,'').trim(),'tamil','iast');
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
                //blackout.remove();
                return;
            }
            if(tamlines[n].trim().split(/\s+/).length !== englines[n].trim().split(/\s+/).length) {
                
                warnings.innerHTML = (`<div><b>Line ${n+1}</b>: Tamil & English don't match.</div>`);
                warnings.style.border = '1px dotted red';
                warnings.style.padding = '1rem';
                //blackout.remove();
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
    warnings.innerHTML = '';

    const tables = makeAlignmentTable(ret.alignment,tamlines.map(l => l.replaceAll(/\/.+?(?=\s|$)/g,'')),ret.warnings);
    for(const table of tables)
        output.appendChild(table); 

    if(lookup) inputs[2].value = Splitter.refreshTranslation(tamlines,_state.wordlist);

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

    wordlistel.innerHTML = '';
    wordlistel.append(res);
    const tds = wordlistel.querySelectorAll('td span');
    for(const td of [...tds].reverse()) {
        td.focus();
        td.blur();
    }
    document.getElementById('saveasbutton').style.display = 'inline';
    document.getElementById('saveasbutton').disabled = false;
    document.getElementById('saveasbutton').title = '';
    //blackout.remove();
};

const formatPoem = (str,inputs) => {
    const lines = str.replaceAll('[','<supplied>')
                     .replaceAll(']','</supplied>')
                     .replaceAll(/\d/g,'')
                     .split(/\n/)
                     .map(l => `<l>${l.trim()}</l>`);
    const puttuvil = (inputs[1].value.includes('∞') || inputs[2].value.includes('∞')) ?
        ' style="pūṭṭuvil"' : '';
    return `<text xml:lang="ta" type="edition">\n  <body>\n    <div xml:id="${_state.poemid}">\n      <lg type="edition"${puttuvil}>\n${lines.join('\n')}\n</lg>\n    </div>\n  </body>\n</text>`;
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

window.addEventListener('load',() => {
    Splitter.listEdit.state = _state;
    document.getElementById('alignbutton').addEventListener('click',alignCheck);
    document.getElementById('saveasbutton').addEventListener('click',saveAs);
    document.getElementById('wordlist').addEventListener('click',Splitter.listEdit.click);
    document.getElementById('wordlist').addEventListener('keydown',Splitter.listEdit.keydown);
    document.getElementById('wordlist').addEventListener('focusin',Splitter.listEdit.focusin);
});
