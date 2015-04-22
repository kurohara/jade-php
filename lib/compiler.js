
module.exports = function (jade) {
    var sys = require('sys');

    var isConstant = require('constantinople');
    if (!jade) {
        jade = require('jade');
    }

    var characterParser = require('character-parser');

    function assertExpression(exp) {
        // this verifies that a JavaScript expression is valid
        // Fix this for php
        return true;
    }
    function assertNestingCorrect(exp) {
        //this verifies that code is properly nested, but allows
        //invalid JavaScript such as the contents of `attributes`
        var res = characterParser(exp)
        if (res.isNesting()) {
            throw new Error('Nesting must match on expression `' + exp + '`')
        }
    }
    
    // Precisa sobrescrever para retirar validação JS
    jade.Lexer.prototype.code = function () {
        var captures;
        if (captures = /^(!?=|-)[ \t]*([^\n]+)/.exec(this.input)) {
            this.consume(captures[0].length);
            var flags = captures[1];
            captures[1] = captures[2];
            var tok = this.tok('code', captures[1]);
            tok.escape = flags.charAt(0) === '=';
            tok.buffer = flags.charAt(0) === '=' || flags.charAt(1) === '=';
            // if (tok.buffer) assertExpression(captures[1])
            return tok;
        }
    };


    jade.Compiler.prototype.visitCode = function (code) {
        var val = code.val;

        if (code.buffer) {
            if (code.escape) {
                val = 'htmlspecialchars(' + val + ', ENT_QUOTES, \'UTF-8\')';
            }

            val = 'echo ' + val + ';'
        }

        this.buffer('<?php ' + val + ' ?>');

        if (code.block) {
            if (!code.buffer) this.buf.push('{');
            this.visit(code.block);
            if (!code.buffer) this.buf.push('}');
        }
    };

    /**
     *
     */
    function toConstant(src) {
      return isConstant.toConstant(src, {jade: jade.runtime, 'jade_interp': undefined});
    }

    jade.Compiler.prototype.attrs = function(attrs, buffer){
      var buf = [];
      var classes = [];
      var classEscaping = [];
  
      attrs.forEach(function(attr){
        var key = attr.name;
        var escaped = attr.escaped;
  
        var val = attr.val;

        if (!isConstant(val)) {
            if (escaped) {
                val = 'htmlspecialchars(' + val + ', ENT_QUOTES, \'UTF-8\')';
            }

            val = '"<?php echo ' + val + '; ?>"';

            escaped = false;
        }
        if (key === 'class') {
          classes.push(val);
          classEscaping.push(escaped);
        } else if (isConstant(attr.val)) {
          if (buffer) {
            this.buffer(jade.runtime.attr(key, toConstant(attr.val), escaped, this.terse));
          } else {
            var val = toConstant(attr.val);
            if (key === 'style') val = jade.runtime.style(val);
            if (escaped && !(key.indexOf('data') === 0 && typeof val !== 'string')) {
              val = jade.runtime.escape(val);
            }
            buf.push(jade.utils.stringify(key) + ': ' + jade.utils.stringify(val));
          }
        } else {
          if (buffer) {
            this.bufferExpression('jade.attr("' + key + '", ' + val + ', ' + jade.utils.stringify(escaped) + ', ' + jade.utils.stringify(this.terse) + ')');
          } else {
            if (key === 'style') {
              val = 'jade.style(' + val + ')';
            }
            if (escaped && !(key.indexOf('data') === 0)) {
              val = 'jade.escape(' + val + ')';
            } else if (escaped) {
              val = '(typeof (jade_interp = ' + val + ') == "string" ? jade.escape(jade_interp) : jade_interp)';
            }
            buf.push(jade.utils.stringify(key) + ': ' + val);
          }
        }
      }.bind(this));
      if (buffer) {
        if (classes.every(isConstant)) {
          this.buffer(jade.runtime.cls(classes.map(toConstant), classEscaping));
        } else {
          this.bufferExpression('jade.cls([' + classes.join(',') + '], ' + jade.utils.stringify(classEscaping) + ')');
        }
      } else if (classes.length) {
        if (classes.every(isConstant)) {
          classes = jade.utils.stringify(jade.runtime.joinClasses(classes.map(toConstant).map(jade.runtime.joinClasses).map(function (cls, i) {
            return classEscaping[i] ? jade.runtime.escape(cls) : cls;
          })));
        } else {
          classes = '(jade_interp = ' + jade.utils.stringify(classEscaping) + ',' +
            ' jade.joinClasses([' + classes.join(',') + '].map(jade.joinClasses).map(function (cls, i) {' +
            '   return jade_interp[i] ? jade.escape(cls) : cls' +
            ' }))' +
            ')';
        }
        if (classes.length)
          buf.push('"class": ' + classes);
      }
      return '{' + buf.join(',') + '}';
    };

};
