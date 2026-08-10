"""Local Quoridor value-network experiment. Nothing here ships to the browser."""
from __future__ import annotations

import json, math, random, time
from dataclasses import dataclass, replace
from pathlib import Path
from collections import deque
from functools import lru_cache
import numpy as np
import torch
from torch import nn

ROOT = Path(__file__).resolve().parent
SIZE = 9
DIRS = ((-1,0),(1,0),(0,-1),(0,1))

@dataclass(frozen=True)
class State:
    pawns: tuple[tuple[int,int], tuple[int,int]] = ((8,4),(0,4))
    walls_left: tuple[int,int] = (10,10)
    walls: tuple[tuple[str,int,int], ...] = ()
    player: int = 0
    winner: int = -1
    turn: int = 0

def blocked(s, a, b):
    ar,ac=a; br,bc=b
    if ar==br:
        c=min(ac,bc)
        return any(o=='v' and col==c and (row==ar or row==ar-1) for o,row,col in s.walls)
    r=min(ar,br)
    return any(o=='h' and row==r and (col==ac or col==ac-1) for o,row,col in s.walls)

def pawn_moves(s, player=None):
    if s.winner>=0: return []
    p=s.player if player is None else player; start=s.pawns[p]; opp=s.pawns[1-p]; out=[]
    for dr,dc in DIRS:
        a=(start[0]+dr,start[1]+dc)
        if not (0<=a[0]<SIZE and 0<=a[1]<SIZE) or blocked(s,start,a): continue
        if a!=opp: out.append(('p',a[0],a[1])); continue
        jump=(opp[0]+dr,opp[1]+dc)
        if 0<=jump[0]<SIZE and 0<=jump[1]<SIZE and not blocked(s,opp,jump):
            out.append(('p',jump[0],jump[1])); continue
        sides=((0,-1),(0,1)) if dr else ((-1,0),(1,0))
        for sr,sc in sides:
            d=(opp[0]+sr,opp[1]+sc)
            if 0<=d[0]<SIZE and 0<=d[1]<SIZE and not blocked(s,opp,d): out.append(('p',d[0],d[1]))
    return out

@lru_cache(maxsize=500_000)
def shortest(s, player):
    start=s.pawns[player]; goal=0 if player==0 else SIZE-1; q=deque([(start,0)]); seen={start}
    while q:
        a,d=q.popleft()
        if a[0]==goal: return d
        for dr,dc in DIRS:
            b=(a[0]+dr,a[1]+dc)
            if 0<=b[0]<SIZE and 0<=b[1]<SIZE and b not in seen and not blocked(s,a,b):
                seen.add(b); q.append((b,d+1))
    return 99

@lru_cache(maxsize=100_000)
def path(s, player):
    start=s.pawns[player]; goal=0 if player==0 else SIZE-1; q=deque([start]); parent={start:None}; end=None
    while q:
        a=q.popleft()
        if a[0]==goal: end=a; break
        for dr,dc in DIRS:
            b=(a[0]+dr,a[1]+dc)
            if 0<=b[0]<SIZE and 0<=b[1]<SIZE and b not in parent and not blocked(s,a,b):
                parent[b]=a; q.append(b)
    out=[]
    while end is not None: out.append(end); end=parent[end]
    return tuple(out[::-1])

@lru_cache(maxsize=500_000)
def legal_wall(s, w):
    o,r,c=w
    if s.winner>=0 or s.walls_left[s.player]<=0 or not (0<=r<SIZE-1 and 0<=c<SIZE-1): return False
    for po,pr,pc in s.walls:
        if po!=o and pr==r and pc==c: return False
        if po==o=='h' and pr==r and abs(pc-c)<=1: return False
        if po==o=='v' and pc==c and abs(pr-r)<=1: return False
    trial=replace(s,walls=s.walls+(w,))
    return shortest(trial,0)<99 and shortest(trial,1)<99

@lru_cache(maxsize=100_000)
def wall_pool(s):
    pool=set()
    for p in (0,1):
        pp=path(s,p)
        for a,b in zip(pp,pp[1:]):
            if a[0]!=b[0]:
                r=min(a[0],b[0]); pool.update((('h',r,a[1]),('h',r,a[1]-1)))
            else:
                c=min(a[1],b[1]); pool.update((('v',a[0],c),('v',a[0]-1,c)))
        r0,c0=s.pawns[p]
        for r in range(r0-2,r0+2):
            for c in range(c0-2,c0+2): pool.update((('h',r,c),('v',r,c)))
    return tuple(w for w in pool if legal_wall(s,w))

@lru_cache(maxsize=200_000)
def moves(s, limit=12):
    pm=pawn_moves(s)
    if not s.walls_left[s.player]: return tuple(pm)
    me=s.player; op=1-me; own0=shortest(s,me); opp0=shortest(s,op); orow,ocol=s.pawns[op]
    scored=[]
    for w in wall_pool(s):
        trial=replace(s,walls=s.walls+(w,)); _,r,c=w
        score=(shortest(trial,op)-opp0)*40-(shortest(trial,me)-own0)*28+SIZE-abs(r+.5-orow)-abs(c+.5-ocol)
        scored.append((score,w))
    scored.sort(reverse=True)
    return tuple(pm+[w for _,w in scored[:limit]])

def apply(s,m):
    p=s.player; pawns=list(s.pawns); wl=list(s.walls_left); walls=s.walls; winner=-1
    if m[0]=='p':
        pawns[p]=(m[1],m[2]); winner=p if m[1]==(0 if p==0 else SIZE-1) else -1
    else: walls=walls+(m,); wl[p]-=1
    return State(tuple(pawns),tuple(wl),walls,1-p,winner,s.turn+1)

def features(s, perspective):
    op=1-perspective; own=shortest(s,perspective); other=shortest(s,op)
    pr,pc=s.pawns[perspective]; qr,qc=s.pawns[op]
    own_prog=(SIZE-1-pr if perspective==0 else pr)/(SIZE-1)
    opp_prog=(SIZE-1-qr if op==0 else qr)/(SIZE-1)
    return np.array([own/SIZE,other/SIZE,(other-own)/SIZE,s.walls_left[perspective]/10,s.walls_left[op]/10,
      (s.walls_left[perspective]-s.walls_left[op])/10,own_prog,opp_prog,(own_prog-opp_prog),
      len(pawn_moves(s,perspective))/6,len(pawn_moves(s,op))/6,pr/8,pc/8,qr/8,qc/8,len(s.walls)/20],dtype=np.float32)

def heuristic(s, perspective):
    if s.winner==perspective: return 1000
    if s.winner==1-perspective: return -1000
    f=features(s,perspective)
    return float((f[1]-f[0])*10+(f[3]-f[4])*.45+(f[6]-f[7])*.7+(f[9]-f[10])*.15)

def shallow_agent(s, rng, stochastic=.0, limit=12):
    p=s.player; ranked=[]
    for m in moves(s,limit):
        child=apply(s,m)
        replies=moves(child,max(5,limit-3))
        value=min((heuristic(apply(child,r),p) for r in replies),default=heuristic(child,p))
        ranked.append((value,m))
    ranked.sort(reverse=True,key=lambda x:x[0])
    if stochastic and len(ranked)>1 and ranked[0][0]<900:
        top=ranked[:min(4,len(ranked))]; vals=np.array([x[0] for x in top]); probs=np.exp((vals-vals.max())/stochastic); probs/=probs.sum()
        return top[int(rng.choice(len(top),p=probs))][1]
    return ranked[0][1]

def greedy_agent(s, rng, temperature=.18, limit=9):
    ranked=sorted(((heuristic(apply(s,m),s.player),m) for m in moves(s,limit)),reverse=True,key=lambda x:x[0])
    top=ranked[:min(4,len(ranked))]
    vals=np.array([x[0] for x in top]); probs=np.exp((vals-vals.max())/temperature); probs/=probs.sum()
    return top[int(rng.choice(len(top),p=probs))][1]

def play(a0,a1,seed,max_turns=90,collect=False):
    rng=np.random.default_rng(seed); s=State(); records=[]
    while s.winner<0 and s.turn<max_turns:
        if collect: records.append((features(s,0),features(s,1),s.player))
        s=apply(s,(a0 if s.player==0 else a1)(s,rng))
    return s.winner,records,s.turn

class ValueNet(nn.Module):
    def __init__(self):
        super().__init__(); self.net=nn.Sequential(nn.Linear(16,128),nn.ReLU(),nn.Linear(128,64),nn.ReLU(),nn.Linear(64,1),nn.Tanh())
    def forward(self,x): return self.net(x).squeeze(-1)

def neural_agent(model,device,temperature=.10):
    def choose(s,rng):
        p=s.player; roots=moves(s,10); leaf_states=[]; spans=[]
        for m in roots:
            child=apply(s,m); replies=moves(child,8)
            start=len(leaf_states); leaf_states.extend(apply(child,r) for r in replies)
            spans.append((start,len(leaf_states),child))
        batch=np.stack([features(x,p) for x in leaf_states]) if leaf_states else np.stack([features(s,p)])
        with torch.no_grad(): values=model(torch.from_numpy(batch).to(device)).cpu().numpy()
        ranked=[]
        for m,(lo,hi,child) in zip(roots,spans):
            v=float(values[lo:hi].min()) if hi>lo else heuristic(child,p)/10
            if child.winner==p: v=10
            ranked.append((v,m))
        ranked.sort(reverse=True,key=lambda x:x[0]); top=ranked[:min(4,len(ranked))]
        if top[0][0]>=9: return top[0][1]
        vals=np.array([x[0] for x in top]); probs=np.exp((vals-vals.max())/temperature); probs/=probs.sum()
        return top[int(rng.choice(len(top),p=probs))][1]
    return choose

def main():
    started=time.time(); device=torch.device('cuda' if torch.cuda.is_available() else 'cpu'); rng=np.random.default_rng(20260810)
    old=lambda s,r: shallow_agent(s,r,0,8); exploratory=lambda s,r: greedy_agent(s,r,.22,9)
    xs=[]; ys=[]; games=[]
    for i in range(24):
        winner,recs,turns=play(exploratory,old if i%2 else exploratory,1000+i,collect=True); games.append((winner,turns))
        for f0,f1,_ in recs:
            xs.extend((f0,f1)); ys.extend((1 if winner==0 else -1,1 if winner==1 else -1))
    x=torch.from_numpy(np.stack(xs)); y=torch.tensor(ys,dtype=torch.float32)
    order=torch.randperm(len(x),generator=torch.Generator().manual_seed(7)); split=int(len(x)*.82); tr,va=order[:split],order[split:]
    model=ValueNet().to(device); opt=torch.optim.AdamW(model.parameters(),lr=2e-3,weight_decay=1e-4); loss_fn=nn.MSELoss(); history=[]
    for epoch in range(80):
        model.train(); perm=tr[torch.randperm(len(tr))]
        for j in range(0,len(perm),512):
            idx=perm[j:j+512]; pred=model(x[idx].to(device)); loss=loss_fn(pred,y[idx].to(device)); opt.zero_grad(); loss.backward(); opt.step()
        if epoch%5==0 or epoch==79:
            model.eval()
            with torch.no_grad(): vl=loss_fn(model(x[va].to(device)),y[va].to(device)).item(); acc=((model(x[va].to(device))>0)==(y[va].to(device)>0)).float().mean().item()
            history.append((epoch,vl,acc))
    neural=neural_agent(model,device); results=[]; openings=[]
    for i in range(10):
        if i%2==0: winner,_,turns=play(neural,old,5000+i); neural_won=winner==0
        else: winner,_,turns=play(old,neural,5000+i); neural_won=winner==1
        results.append((neural_won,turns))
    for seed in range(12):
        s=State(); seq=[]; rr=np.random.default_rng(9000+seed)
        for _ in range(6):
            m=neural(s,rr) if s.player==0 else old(s,rr); seq.append(m); s=apply(s,m)
        openings.append(str(seq))
    weights={k:v.detach().cpu().tolist() for k,v in model.state_dict().items()}
    torch.save(model.state_dict(),ROOT/'value_agent.pt')
    data={'device':str(device),'gpu':torch.cuda.get_device_name(0) if device.type=='cuda' else None,'training_games':len(games),'positions':len(x),
      'validation_loss':history[-1][1],'validation_accuracy':history[-1][2],'epochs':80,'match_games':len(results),
      'wins':sum(w for w,_ in results),'losses':sum(not w for w,_ in results),'win_rate':sum(w for w,_ in results)/len(results),
      'mean_turns':float(np.mean([t for _,t in results])),'distinct_openings':len(set(openings)),'elapsed_seconds':time.time()-started,
      'history':history,'parameter_count':sum(p.numel() for p in model.parameters()),'weights_json_bytes':len(json.dumps(weights))}
    (ROOT/'results.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
    print(json.dumps(data,indent=2))

if __name__=='__main__': main()
