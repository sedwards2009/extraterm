/* description: Parses template strings. */


/* lexical grammar */
%lex

%x field

%%
[^$\\]+          return 'STRING';
[$]$             return 'DOLLAR';
[$][^{]          return 'DOLLAR';
"${"             this.begin('field');
"\$"             return 'ESCAPE_DOLLAR';

<field>[^:}]+    return 'SYMBOL';
<field>":"      return 'COLON';
<field>"}"      this.popState();
<<EOF>>         return 'EOF';

/lex

%start expressions

%% /* language grammar */

expressions
    : expr
        { return $1; }
    ;

expr
    : string expr
        {
            if ($2.length !== 0 && $2[0].type==="text") {
                $$ = [{ type: "text", text: $1+$2[0].text }, ...$2.slice(1)];
            } else {
                $$ = [{ type: "text", text: $1 }, ...$2];
            }
        }
    | SYMBOL COLON SYMBOL expr
        { $$ = [ { type: "field", namespace: $1, key: $3, html: "", error: "" }, ...$4 ]; }
    | EOF
    ;

string
    : STRING
        { $$=yytext; }
    | ESCAPE_DOLLAR
        { $$ = '$'; }
    | DOLLAR
        { $$ = yytext; }
    ;
