:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_files)).
:- use_module(library(lists)).

% ==========================================
% HTTP SERVER SETUP
% ==========================================

% 1. API endpoints (must be first)
:- http_handler(root(api/move), api_move, []).
:- http_handler(root(api/solve), api_solve, []).

% 2. Explicit static file routes (guarantees correct MIME types)
:- http_handler(root(.), serve_index, []).
:- http_handler(root('css/style.css'), serve_css, []).
:- http_handler(root('js/game.js'), serve_js, []).

serve_index(Request) :- http_reply_file('index.html', [mime_type('text/html')], Request).
serve_css(Request) :- http_reply_file('css/style.css', [mime_type('text/css')], Request).
serve_js(Request) :- http_reply_file('js/game.js', [mime_type('application/javascript')], Request).

start_server(Port) :-
    http_server(http_dispatch, [port(Port)]),
    format('~n============================================~n'),
    format(' SWI-Prolog Hanoi Server is Running!~n'),
    format(' Visit: http://localhost:~w~n', [Port]),
    format('============================================~n~n'),
    flush_output,
    % Keep the server alive
    thread_get_message(_).

:- initialization(start_server(8080), main).

% ==========================================
% API ENDPOINTS
% ==========================================

api_move(Request) :-
    http_read_json_dict(Request, DictIn),
    State = DictIn.state,
    From = DictIn.from,
    To = DictIn.to,
    ( valid_move(State, From, To, NewState) ->
        DictOut = _{valid: true, newState: NewState}
    ;   DictOut = _{valid: false}
    ),
    reply_json_dict(DictOut).

api_solve(Request) :-
    http_read_json_dict(Request, DictIn),
    Disks = DictIn.disks,
    Pegs = DictIn.pegs,
    To is Pegs - 1,
    hanoi(Disks, 0, To, 1, Moves),
    maplist(convert_move, Moves, JSONMoves),
    reply_json_dict(_{moves: JSONMoves}).

convert_move(move(F, T), _{from: F, to: T}).

% ==========================================
% GAME LOGIC (Pure Prolog)
% ==========================================

valid_move(State, From, To, NewState) :-
    nth0(From, State, SourcePeg),
    SourcePeg \= [],
    nth0(To, State, TargetPeg),
    last(SourcePeg, TopDisk),
    ( TargetPeg = []
    ; last(TargetPeg, TargetTop),
      TopDisk < TargetTop
    ),
    append(NewSource, [TopDisk], SourcePeg),
    append(TargetPeg, [TopDisk], NewTarget),
    replace_nth(State, From, NewSource, Temp),
    replace_nth(Temp, To, NewTarget, NewState).

replace_nth(List, Index, NewElem, NewList) :-
    nth0(Index, List, _, Rest),
    nth0(Index, NewList, NewElem, Rest).

hanoi(0, _, _, _, []) :- !.
hanoi(N, From, To, Via, Moves) :-
    N > 0,
    N1 is N - 1,
    hanoi(N1, From, Via, To, Moves1),
    hanoi(N1, Via, To, From, Moves2),
    append(Moves1, [move(From, To) | Moves2], Moves).