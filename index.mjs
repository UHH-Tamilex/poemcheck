import { alignWordsplits } from './lib/debugging/aligner.mjs';
import Splitter from './lib/debugging/splits.mjs';
import Sanscript from './lib/js/sanscript.mjs';
import makeAlignmentTable from './lib/debugging/alignmenttable.mjs';
import { saveAs } from './lib/debugging/fileops.mjs';
import { init as cmWrapper} from './lib/debugging/cmwrapper.mjs';

const _state = {
    cms: {
      metrical: null,
      tamsplit: null,
      engsplit: null
    },
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
    for (const cms of [_state.cms.metrical, _state.cms.tamsplit, _state.cms.engsplit])
      cms.save();

    _state.poemid = document.getElementById('poemid').value || 'poemXX';
    _state.poemtitle = document.getElementById('poemtitle').value || '';
    _state.poemnum = document.getElementById('poemnum').value || '';
    _state.poet = document.getElementById('poet').value || '';

    const output = document.getElementById('alignment');
    output.innerHTML = '';
    const wordlistel = document.getElementById('wordlist');
    wordlistel.innerHTML = '';

    const warnings = document.getElementById('errors');
    warnings.innerHTML = '<div class="spinner"></div>';

    const inputs = document.querySelectorAll('#metrical, #wordsplit, #engsplit');
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

    if(lookup) _state.cms.engsplit.setValue(Splitter.refreshTranslation(tamlines,_state.wordlist));

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

const disableSave = () => {
    document.getElementById('saveasbutton').disabled = true;
    document.getElementById('saveasbutton').title = 'Please realign first.';
};

const formatPoem = (str,inputs) => {
    const lines = str.replaceAll('[','<supplied>')
                     .replaceAll(']','</supplied>')
                     .replaceAll(/\d/g,'')
                     .split(/\n/)
                     .map(l => `<l>${l.trim()}</l>`);
    const puttuvil = (inputs[1].value.includes('∞') || inputs[2].value.includes('∞')) ?
        ' style="pūṭṭuvil"' : '';
    return `<text xml:lang="ta" type="edition">\n  <body>\n    <div rend="parallel">\n      <lg xml:id="${_state.poemid}"${puttuvil}>\n${lines.join('\n')}\n      </lg>\n      <lg xml:lang="en">\n<!--put your translation here-->\n      </lg>\n    </div>\n  </body>\n</text>`;
};

const saveThis = () => {
    const text = 
`<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng" schematypens="http://relaxng.org/ns/structure/1.0" type="application/xml"?>
<?xml-stylesheet type="text/xsl" href="edition.xsl" ?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>
            <title xml:lang="ta">${_state.poemtitle}</title> <num>${_state.poemnum}</num>.
            <persName xml:lang="ta">${_state.poet}</persName>
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
    saveAs(`${_state.poemid}.xml`,text);
};

const startCMs = () => {
  _state.cms.metrical = cmWrapper(document.getElementById('metrical'));
  _state.cms.metrical.setSize('100%','100%');
  _state.cms.metrical.on('change',disableSave);
  _state.cms.tamsplit = cmWrapper(document.getElementById('wordsplit'));
  _state.cms.tamsplit.setSize('100%','100%');
  _state.cms.tamsplit.on('change',disableSave);
  _state.cms.engsplit = cmWrapper(document.getElementById('engsplit'));
  _state.cms.engsplit.setSize('100%','100%');
  _state.cms.engsplit.on('change',disableSave);
  _state.cursor = {line: null, ch: null}; 
  _state.cms.engsplit.on('cursorActivity', matchCursor);
  _state.cms.tamsplit.on('cursorActivity', matchCursor);
  _state.cms.metrical.on('cursorActivity', matchCursor);
};

const matchCursor = thiscm => {
  if(thiscm.somethingSelected()) return;

  const othercms = [_state.cms.metrical, _state.cms.tamsplit, _state.cms.engsplit].filter(c => c !== thiscm);

  const cursor = thiscm.getCursor();
  const contents = thiscm.getLine(cursor.line);
  const wordnum = (contents.slice(0,cursor.ch).match(/\s+/g)||[]).length;
  if(_state.cursor.line === cursor.line && _state.cursor.word == wordnum)
    return;
  
  _state.cursor = {line: cursor.line, word: wordnum};
  
  for(const thatcm of othercms) {
    const thatcontents = thatcm.getLine(cursor.line);
    if(!thatcontents) continue;

    if(thatcm === _state.cms.metrical || thiscm === _state.cms.metrical) {
      thatcm.setSelection({line: cursor.line, ch: 0}, {line: cursor.line, ch: thatcontents.length});
      continue;
    }

    const thatspaces = thatcontents.matchAll(/\s+|$/g);
    let n = 0;
    let startindex = 0;
    for(const match of thatspaces) {
      if(n === wordnum) {
        const start = startindex === 0 ? 0 : startindex + 1;
        thatcm.setSelection({line: cursor.line, ch: start}, {line:cursor.line, ch: match.index});
        break;
      }
      if(n === wordnum-1)
        startindex = match.index;
      n = n + 1;
    }
  }
};

window.addEventListener('load',() => {
    Splitter.listEdit.state = _state;
    document.getElementById('alignbutton').addEventListener('click',alignCheck);
    document.getElementById('saveasbutton').addEventListener('click',saveThis);
    document.getElementById('wordlist').addEventListener('click',Splitter.listEdit.click);
    document.getElementById('wordlist').addEventListener('keydown',Splitter.listEdit.keydown);
    document.getElementById('wordlist').addEventListener('focusin',Splitter.listEdit.focusin);
    for(const box of document.querySelectorAll('input')) {
        box.addEventListener('keyup',disableSave);
        box.addEventListener('change',disableSave);
    }
    startCMs();
});
