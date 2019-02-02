/* description: Parses boolean expressions into an AST. */

/* lexical grammar */
%lex

%%
\s+                   /* skip whitespace */
[a-zA-Z]+?\b          return 'SYMBOL';
"||"                  return '||';
"&&"                   return '&&';
"!"                   return '!';
"("                   return '(';
")"                   return ')';
<<EOF>>               return 'EOF';

/lex

/* operator associations and precedence */

%left '||'
%left '&&'
%left NOT

%start expressions

%% /* language grammar */

expressions
    : e EOF
        {console.log("Result: ", $1); return $1;}
    ;

e
    : e '||' e
        {$$ = { type: "||", left: $1, right: $3}; }
    | e '&&' e
        {$$ = { type: "&&", left: $1, right: $3}; }
    | '!' e %prec NOT
        {$$ = { type: "!", operand: $2}; }
    | '(' e ')'
        {$$ = { type: "brackets", operand: $2}; }
    | SYMBOL
        {$$ = { type: "symbol", name: yytext}; }
    ;
