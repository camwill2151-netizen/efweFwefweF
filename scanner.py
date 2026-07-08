import requests,sys
CG="https://api.coingecko.com/api/v3"
def j(u,p=None): r=requests.get(u,params=p,timeout=20); r.raise_for_status(); return r.json()
def top20(): return j(f"{CG}/coins/markets",{"vs_currency":"usd","order":"market_cap_desc","per_page":20,"page":1,"sparkline":"false","price_change_percentage":"24h,7d"})
def fear_greed():
    try: return int(j("https://api.alternative.me/fng/")["data"][0]["value"])
    except: return 50
def tech(c):
    p24=c.get("price_change_percentage_24h_in_currency") or 0; p7=c.get("price_change_percentage_7d_in_currency") or 0
    return (1 if p24>2 else -1 if p24<-2 else 0)+(1 if p7>5 else -1 if p7<-5 else 0)
def fund(c):
    mc=c.get("market_cap") or 0; vol=c.get("total_volume") or 0; r=(vol/mc) if mc else 0
    return (1 if r>0.08 else -1 if r<0.02 else 0)+(1 if (c.get("market_cap_rank") or 999)<=10 else 0)
def sent(fg): return 1 if fg>=65 else -1 if fg<=35 else 0
def sig(x): return "BUY" if x>=2 else "SELL" if x<=-2 else "HOLD"
def run():
    fg=fear_greed(); out=[]
    for c in top20():
        t,f,s=tech(c),fund(c),sent(fg); z=t+f+s
        out.append((z,c["symbol"].upper(),c["current_price"],sig(z),t,f,s))
    out.sort(reverse=True,key=lambda x:x[0])
    print(f"Fear&Greed={fg}"); print("RANK SYM  PRICE        SCORE SIGNAL (T/F/S)")
    for i,(z,sym,p,sg,t,f,se) in enumerate(out,1): print(f"{i:>2}   {sym:<4} {p:<12.6g} {z:>2}    {sg:<5} ({t}/{f}/{se})")
if __name__=="__main__":
    try: run()
    except Exception as e: print("error:",e); sys.exit(1)
