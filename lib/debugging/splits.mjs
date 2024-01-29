import { alignWordsplits } from './aligner.mjs';
import { Sanscript } from '../js/sanscript.mjs';
import makeAlignmentTable from './alignmenttable.mjs';

var Transliterate;
const setTransliterator = (obj) => Transliterate = obj;

const addWordSplits = () => {
    const blackout = document.getElementById('blackout');
    const popup = document.getElementById('splits-popup');
    const selector = popup.querySelector('select');
    for(const lg of document.querySelectorAll('.lg')) {
        if(!lg.id) continue;
        const option = document.createElement('option');
        option.value = lg.id;
        option.append(lg.id);
        selector.append(option);
    }
    
    popup.querySelector('button').addEventListener('click',showSplits);
    blackout.style.display = 'flex';
    popup.style.display = 'flex';
    blackout.addEventListener('click',cancelPopup);
};

const cancelPopup = (e) => {
    const targ = e.target.closest('.popup');
    if(targ) return;

    const blackout = document.getElementById('blackout');
    blackout.style.display = 'none';
    blackout.querySelector('button').innerHTML = 'Align';
    blackout.querySelector('select').innerHTML = '';
    for(const textarea of blackout.querySelectorAll('textarea'))
        textarea.value = '';

    const popup = document.getElementById('splits-popup');
    popup.style.display = 'none';
    popup.querySelector('.output-boxen').style.display = 'none';
    popup.querySelector('.popup-output').innerHTML = '';
    popup.querySelector('.popup-warnings').innerHTML = '';

    popup.style.height = '50%';
    popup.querySelector('.boxen').style.height = '100%';
};

const showSplits = async () => {
    const popup = document.getElementById('splits-popup');
    popup.style.height = '80%';
    popup.querySelector('.boxen').style.height = 'unset';

    popup.querySelector('button').innerHTML = 'Re-align';

    popup.querySelector('.output-boxen').style.display = 'flex';

    const output = popup.querySelector('.popup-output');
    output.innerHTML = '';

    const warnings = popup.querySelector('.popup-warnings');
    warnings.innerHTML = '';

    const inputs = popup.querySelectorAll('textarea');
    const tamval = Sanscript.t(inputs[0].value.trim(),'tamil','iast');
    //const tam = tamval.split(/\s+/).map(s => s.replace(/[,.;?!]$/,''));
    const tamlines = tamval.replaceAll(/[,.;?!](?=\s|$)/g,'').split(/\n+/);
    const tam = tamlines.reduce((acc,cur) => acc.concat(cur.trim().split(/\s+/)),[]);

    const engval = inputs[1].value.trim();
    const eng = engval ? engval.split(/\s+/).map(s => s.replace(/[,.;?!]$/,'')) :
                         Array(tam.length).fill('');

    if(engval) {
        const englines = engval.split(/\n+/);
        for(let n=0;n<tamlines.length;n++) {
            if(tamlines[n].trim().split(/\s+/).length !== englines[n].trim().split(/\s+/).length) {
                
                warnings.innerHTML = (`<div>Line ${n+1}: Tamil & English don't match.</div>`);
                output.style.border = 'none';
                output.style.display = 'none';
                return;
            }
        }
    }

    const blockid = popup.querySelector('select').value;

    const textblock = document.getElementById(blockid).querySelector('.text-block');
    const text = Transliterate.getCachedText(textblock);

    const lookup = popup.querySelector('input[name="lookup"]').checked;

    const ret = await alignWordsplits(text,tam,eng,lookup);

    makeAlignmentTable(ret.alignment,tamlines,warnings);
    
    if(lookup) inputs[1].value = refreshTranslation(tamlines,ret.wordlist);

    output.style.display = 'block';
    output.style.border = '1px solid black';
    const standOff =`<standOff type="wordsplit" corresp="#${blockid}">\n${ret.xml}\n</standOff>`;
    output.innerHTML = Prism.highlight(standOff,Prism.languages.xml,'xml');
    
    copyToClipboard(standOff,popup);
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

const copyToClipboard = (xml,popup) => {
    navigator.clipboard.writeText(xml).then(
        () => {
            const par = popup.querySelector('.popup-output');
            const tip = document.createElement('div');
            tip.style.position = 'absolute';
            tip.style.top = 0;
            tip.style.right = 0;
            tip.style.background = 'rgba(0,0,0,0.5)';
            tip.style.color = 'white';
            tip.style.padding = '0.5rem';
            tip.append('Copied to clipboard.');
            par.appendChild(tip);
            tip.animate([
                {opacity: 0},
                {opacity: 1, easing: 'ease-in'}
                ],200);
            setTimeout(() => tip.remove(),1000);
        },
        () => {
            const par = popup.querySelector('.popup-output');
            const tip = document.createElement('div');
            tip.style.position = 'absolute';
            tip.style.top = 0;
            tip.style.right = 0;
            tip.style.background = 'rgba(0,0,0,0.5)';
            tip.style.color = 'red';
            tip.style.padding = '0.5rem';
            tip.append('Couldn\'t copy to clipboard.');
            par.appendChild(tip);
            setTimeout(() => tip.remove(),1000);
        }
    );
};

/*
const addcsvwordsplit = (e) => {
    Papa.parse(e.target.files[0], {
        complete: (res) => {
            const data = res.data;
            if(data[0][0] === 'Word') data.shift();
            showsplits(data);
        }
    });
};
const showsplits = (arr) => {
    const concated = arr.map(el => el[0]).join(' ');
    const textblock = document.querySelector('.text-block');
    const text = textblock.textContent.replaceAll('\u00AD','');
    const aligned = NeedlemanWunsch(text,concated);
    const splits = alignmentToSplits(aligned,arr.map(el => el[1]));
    const id = textblock.closest('[id]').id;
    
    const ret = `<standOff corresp="#${id}" type="wordsplit">\n` + 
        makeEntries(splits).join('\n') +
        '\n</standOff>';

    makepopup(ret);
};
const makepopup = (str) => {
    const popup = document.createElement('div');
    popup.className = 'popup';
    const code = document.createElement('code');
    code.className = 'language-xml';
    code.style.whiteSpace = 'pre';
    code.append(str);
    popup.append(code);
    const blackout = document.createElement('div');
    blackout.id = 'blackout';
    blackout.append(popup);
    Prism.highlightAllUnder(popup);
    document.body.appendChild(blackout);
    blackout.addEventListener('click',(e) => {
        const targ = e.target.closest('.popup');
        if(!targ)
            document.querySelector('#blackout').remove();
    });
};

const alignmentToSplits = (aligned, translations) => {
    let words = [];
    let wordstart = 0;
    let wordend = 0;
    let curword = '';
    for(let n=0; n<aligned[0].length;n++) {
        if(aligned[1][n].match(/[\n\s]/)) {
            const ret = {word: curword, start: wordstart, end: wordend};
            const translation = translations.shift();
            if(translation) ret.translation = translation;
            words.push(ret);

            curword = '';
            if(aligned[0][n].match(/[\n\s]/))
                wordstart = wordend + 1;
            else wordstart = wordend;
        }
        else {
            if(curword === '' && aligned[0][n].match(/[\n\s]/))
                wordstart = wordend + 1;
            curword += aligned[1][n];
        }

        if(aligned[0][n] !== '') wordend += 1;
    }
    if(curword) { // might be "" if wordsplit is only partial
        const ret = {word: curword, start: wordstart, end: wordend};
        const translation = translations.shift();
        if(translation) ret.translation = translation;
        words.push(ret);
    }

    return words;
};

const makeEntries = (list) => {
    const formatWord = (w) => {
        return w.replace(/([~+()])/g,'<pc>$1</pc>')
                .replaceAll(/['’]/g,'<pc>(</pc>u<pc>)</pc>')
                //.replaceAll(/\[(.+?)\]/g,'<supplied>$1</supplied>');
                .replaceAll(/\[(.+?)\]/g,'$1');
    };
    return list.map(e => {
        const select = e.hasOwnProperty('strand') ? ` select="${e.strand}"` : '';
        const translation = e.hasOwnProperty('translation') ? `\n    <def>${e.translation}</def>` : '';
        return `  <entry corresp="${e.start},${e.end}"${select}>\n    <form>${formatWord(e.word)}</form>${translation}\n</entry>`;
    });
};
*/

const Splitter = {
    addWordSplits: addWordSplits,
    setTransliterator: setTransliterator
};

export default Splitter;
