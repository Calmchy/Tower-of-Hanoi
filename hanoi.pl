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
    % Every peg except the source (0) and the target (last) is a spare
    LastSpare is Pegs - 2,
    numlist(1, LastSpare, Spares),
    hanoi(Disks, 0, To, Spares, Moves),
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

% ------------------------------------------
% Frame-Stewart solver (uses ALL the pegs)
% ------------------------------------------
% hanoi(+N, +From, +To, +Spares, -Moves)
% Spares is the list of free pegs besides From and To, so the number of
% pegs in play is length(Spares) + 2.
%
% With P pegs, move the top K disks onto one spare peg (using all P pegs),
% move the remaining N-K disks to the target (using P-1 pegs, since the
% spare holding the K disks is blocked), then move the K disks on top.
% With 3 pegs this is exactly the classic 2^N - 1 solution.

hanoi(0, _, _, _, []) :- !.
hanoi(1, From, To, _, [move(From, To)]) :- !.
hanoi(N, From, To, [Via | Rest], Moves) :-
    N > 1,
    length(Rest, R),
    P is R + 3,                            % From + To + Via + Rest
    best_k(N, P, K),
    NK is N - K,
    hanoi(K,  From, Via, [To | Rest],   Moves1),
    hanoi(NK, From, To,  Rest,          Moves2),
    hanoi(K,  Via,  To,  [From | Rest], Moves3),
    append([Moves1, Moves2, Moves3], Moves).

% fs_cost(+N, +P, -Cost): fewest moves for N disks on P pegs
% (Frame-Stewart; fails if impossible, e.g. 2 disks on 2 pegs).
:- table fs_cost/3.
fs_cost(0, _, 0).
fs_cost(1, P, 1) :- P >= 2.
fs_cost(N, 3, Cost) :- N > 1, Cost is (1 << N) - 1.
fs_cost(N, P, Cost) :-
    N > 1, P > 3,
    N1 is N - 1,
    P1 is P - 1,
    aggregate_all(min(C), split_cost(N, N1, P, P1, _, C), Cost).

split_cost(N, N1, P, P1, K, Cost) :-
    between(1, N1, K),
    NK is N - K,
    fs_cost(K, P, CK),
    fs_cost(NK, P1, CNK),
    Cost is 2 * CK + CNK.

% best_k(+N, +P, -K): how many disks to park on the spare peg first
best_k(N, 3, K) :- !, K is N - 1.
best_k(N, P, K) :-
    N1 is N - 1,
    P1 is P - 1,
    aggregate_all(min(C, Kc), split_cost(N, N1, P, P1, Kc, C), min(_, K)).