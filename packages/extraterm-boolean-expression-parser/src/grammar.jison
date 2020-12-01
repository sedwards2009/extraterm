/* description: Parses boolean expressions into an AST. */

/* lexical grammar */
%lex

%%
\s+                   /* skip whitespace */
[a-zA-Z]+?\b          return 'SYMBOL';
['][^']*[']           return 'STRING';
"=="                  return '==';
"!="                  return '!=';
"||"                  return '||';
"&&"                  return '&&';
"!"                   return '!';
"("                   return '(';
")"                   return ')';
<<EOF>>               return 'EOF';

/lex

/* operator associations and precedence */

%left '||'
%left '&&'
%left NOT
%left '=='
%left '!='

%start expressions

%% /* language grammar */

expressions
    : e EOF
        { return $1; }
    ;

e
    : e '||' e
        {$$ = { type: "||", left: $1, right: $3}; }
    | e '&&' e
        {$$ = { type: "&&", left: $1, right: $3}; }
    | e '==' e
        {$$ = { type: "==", left: $1, right: $3}; }
    | e '!=' e
        {$$ = { type: "!=", left: $1, right: $3}; }
    | '!' e %prec NOT
        {$$ = { type: "!", operand: $2}; }
    | '(' e ')'
        {$$ = { type: "brackets", operand: $2}; }
    | SYMBOL
        {$$ = { type: "symbol", name: yytext}; }
    | STRING
        {$$ = { type: "string", value: yytext.substr(1, yytext.length -2)}; }
    ;
