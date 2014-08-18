/**
 * Created by gcannata on 17/08/2014.
 */
var chai = chai || require('chai');
var lexer = lexer || require('../lexer');
var parser = parser || require('../parser');
var StringReader = StringReader || require('../stringreader');
var expect = chai.expect;

var tokenspecs = {
    definitions:  {
        "digits": "[0-9]"
    },
    tokens: [
        {'regexp': '{digits}*\\.{digits}+', action: function(){this.jjval=parseFloat(this.jjtext); return 'float';}},
        { "regexp": '{digits}+', action: function(){this.jjval=parseInt(this.jjtext); return 'integer';}},
        { 'regexp': 'if', action: function(){return 'IF';}},
        { 'regexp': '\\w+', action: function(){return this.jjtext;}}, //or return 'ident'
        { 'regexp': '\\s*', action: function(){console.log('ignore spaces');}},
        { 'regexp': '.', action: function(){return this.jjtext;}},
        { 'regexp': '<<EOF>>', action: function(){console.log('end of file');return 'EOF';}}
    ]
};

/*
 E->E+T | T
 T->T*F | F
 F->( E ) | id
 */
var ExpGrammar = {
    tokens: ['integer','+','*','(',')'],

    productions:[
        ['E',['E','+','T'],function(e,_,t){
            return '('+e+'+'+t+')';
        }],
        ['E',['T'],function(t){
            return t;
        }],
        ['T',['T','*','F'],function(t,_,f){
            return '('+t+'*'+f+')';
        }],
        ['T',['F'],function(f){
            return f;
        }],
        ['F',['(','E',')'],function(e){
            return '('+e+')';
        }],
        ['F',['integer'],function(i){
            return i.toString();
        }]

    ]

};

/*
 NON SLR1
 S -> L=R | R
 L -> *R | id
 R -> L

 es: *id=**id
 */
var NonSLR1Grammar = {
    tokens: ['integer','=','*'],

    productions:[
        ['S',['L','=','R'],function(s,_,r){
            return '('+s+'='+r+')';
        }],
        ['S',['R'],function(r){
            return r;
        }],
        ['L',['*','R'],function(_,r){
            return '('+'*'+r+')';
        }],
        ['L',['integer'],function(i){
            return i.toString();
        }],
        ['R',['L'],function(l){
            return l;
        }]

    ]

};

/* NON LALR1
 S -> aEa | bEb | aFb | bFa
 E -> e
 F -> e
 */
var NonLALR1Grammar = {
    tokens: ['!','?','*'],

    productions:[
        ['S',['!','E','!'],function(_,E){
            return '(!'+E+'!)';
        }],
        ['S',['?','E','?'],function(_,E){
            return '(?'+E+'?)';
        }],
        ['S',['!','F','?'],function(_,F){
            return '(!'+F+'?)';
        }],
        ['S',['?','F','!'],function(_,F){
            return '(?'+F+'!)';
        }],
        ['E',['*'],function(_,F){
            return 'e*';
        }],
        ['F',['*'],function(_,F){
            return 'f*';
        }]
    ]

};

function compileLexer(str){
    var lexersrc = lexer.generateLexer(tokenspecs,{lexerName: 'MyLexer'});
    eval(lexersrc);
    var lexer1 = new MyLexer(new StringReader(str));
    return lexer1;
}

function compileParser(grammar, mode){
    var pg = new parser.ParserGenerator(grammar, {mode: mode});
    var parsersrc = pg.generateParser({parserName: 'MyParser'});
    eval(parsersrc);
    var p1 = new MyParser();
    return p1;
}

describe("parser.Parser",function() {

    describe("SLR mode", function() {
        it('parses SLR grammar', function () {
            var lexer1 = compileLexer('2+3*4+5');
            var p = compileParser(ExpGrammar, 'SLR');
            var ret = p.parse(lexer1);
            expect(ret).to.be.equal('((2+(3*4))+5)');
        });

        it('fails on Non-SLR(1) grammar', function () {
            var lexer1 = compileLexer('*23=18');
            var p;
            expect(function() {
                    p = compileParser(NonSLR1Grammar, 'SLR')
                }
            ).to.throw(/Shift \/ Reduce conflict/);

        });

        it('fails on Non-LALR(1) grammar', function () {
            var p;
            expect(function() {
                    p = compileParser(NonLALR1Grammar, 'SLR');
                }
            ).to.throw(/Reduce\/Reduce conflict/);

        });
    });

    describe("LALR1 mode", function() {
        it('parses SLR grammar', function () {
            var lexer1 = compileLexer('2+3*4+5');
            var p =compileParser(ExpGrammar, 'LALR1');
            var ret = p.parse(lexer1);
            expect(ret).to.be.equal('((2+(3*4))+5)');
        });

        it('parses Non-SLR(1) grammar', function () {
            var lexer1 = compileLexer('*23=18');
            var p = compileParser(NonSLR1Grammar, 'LALR1');
            var ret = p.parse(lexer1);
            expect(ret).to.be.equal('((*23)=18)');

        });

        it('fails on Non-LALR(1) grammar', function () {
            var pg;
            expect(function() {
                    new compileParser(NonLALR1Grammar, 'LALR1');
                }
            ).to.throw(/Reduce\/Reduce conflict/);

        });
    });

    describe("LR1 mode", function() {
        it('parses SLR grammar', function () {
            var lexer1 = new lexer.Lexer(tokenspecs).setInput(new StringReader('2+3*4+5'));
            var pg = new parser.ParserGenerator(ExpGrammar, {mode: 'LR1'});
            var p = new parser.Parser(pg);
            var ret = p.parse(lexer1);
            expect(ret).to.be.equal('((2+(3*4))+5)');
        });

        it('parses Non-SLR(1) grammar', function () {
            var lexer1 = new lexer.Lexer(tokenspecs).setInput(new StringReader('*23=18'));
            var pg = new parser.ParserGenerator(NonSLR1Grammar, {mode: 'LR1'});
            var p = new parser.Parser(pg);
            var ret = p.parse(lexer1);
            expect(ret).to.be.equal('((*23)=18)');

        });

        it('parses Non-LALR(1) grammar', function () {
            var lexer1 = new lexer.Lexer(tokenspecs).setInput(new StringReader('!*?'));
            var pg = new parser.ParserGenerator(NonLALR1Grammar, {mode: 'LR1'});
            var p = new parser.Parser(pg);
            var ret = p.parse(lexer1);
            expect(ret).to.be.equal('(!f*?)');

        });
    });

});