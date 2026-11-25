"""Turn the raw unit definitions into site/units.js."""
import json, os, re, sys
from collections import Counter

ROOT_COMMANDERS = ('armcom', 'corcom')  # these two live at the root of units/, everything else is in a subfolder


def parse(cache):
    L=json.load(open(cache+'/units.json'))['units']
    names,descs=L['names'],L['descriptions']
    armor={}   # unit id -> armor class (anything not listed uses the default damage)
    p=cache+'/armordefs.lua'
    if os.path.exists(p):
        cls=None
        for line in open(p,encoding='utf8',errors='ignore'):
            m=re.match(r'^	(\w+) = \{',line)
            if m: cls=m.group(1); continue
            m=re.match(r'^		"(\w+)"',line)
            if m and cls: armor[m.group(1)]=cls
    def val(s):
        s=s.strip().rstrip(',').strip()
        if s.startswith('"'): return s.strip('"')
        m=re.match(r'^([\d.]+)\s*/\s*([\d.]+)$',s)
        if m and float(m.group(2)): return float(m.group(1))/float(m.group(2))   # a few values are written as fractions, e.g. 1 / 70
        if s in('true','false'): return s=='true'
        try: return float(s) if '.' in s else int(s)
        except: return s
    # units that only exist when the "experimental extra units" game option is on: who can build them then
    exp={}
    p=cache+'/experimental_extra_units.lua'
    if os.path.exists(p):
        who=[]
        for line in open(p,encoding='utf8',errors='ignore'):
            if line.strip().startswith(('if name','elseif name')): who=re.findall(r'name == "(\w+)"',line)
            m=re.search(r'buildoptions\[.*?\]\s*=\s*"(\w+)"',line)
            if m: exp.setdefault(m.group(1),[]).extend(w for w in who if w not in exp.get(m.group(1),[]))
    units={}
    for f in sorted(os.listdir(cache+'/raw')):
        txt=open(cache+'/raw/'+f,encoding='utf8',errors='ignore').read()
        parts=f.split('__')
        stack=[]  # keys
        cur=None
        for line in txt.split('\n'):
            l=line.split('--')[0].strip()
            if not l: continue
            if l.startswith('return'): stack.append('return'); continue
            m=re.match(r'^\[?"?([\w]+)"?\]?\s*=\s*\{(.*)$',l)
            closes=l.count('}'); 
            if m:
                key=m.group(1); rest=m.group(2)
                stack.append(key)
                if len(stack)==2: cur={'id':key,'folder':'/'.join(parts[1:-1]),'weapons':{},'build':[],'cp':{},'wl':{}};units[key]=cur
                if '}' in rest: stack.pop()  # inline close
                continue
            if cur is None:
                if l.startswith('}') and stack: stack.pop()
                continue
            if l.startswith('}'):
                # may be '}' or '},' ; pop
                if stack: stack.pop()
                continue
            d=len(stack)
            m2=re.match(r'^(\w+)\s*=\s*(.+)$',l)
            sec=stack[2] if d>2 else None
            if d==2 and m2: cur[m2.group(1)]=val(m2.group(2))
            elif d==3 and sec=='customparams' and m2: cur['cp'][m2.group(1)]=val(m2.group(2))
            elif d==3 and sec=='buildoptions':
                mm=re.match(r'^(?:\[\d+\]\s*=\s*)?"(\w+)"',l)
                if mm: cur['build'].append(mm.group(1))
            elif d==4 and sec=='weapondefs' and m2:
                cur['weapons'].setdefault(stack[3],{})[m2.group(1)]=val(m2.group(2))
            elif d==5 and sec=='weapondefs' and stack[4]=='damage' and m2:
                cur['weapons'].setdefault(stack[3],{}).setdefault('dm',{})[m2.group(1)]=val(m2.group(2))
            elif d==4 and sec=='weapons' and m2 and m2.group(1) in ('def','onlytargetcategory','badtargetcategory'):
                cur['wl'].setdefault(stack[3],{})[m2.group(1)]=str(val(m2.group(2))).strip('"')
    out=[]
    for k,u in units.items():
        if k not in names: continue
        if u.get('maxwaterdepth') is None and False: pass
        fo=u['folder']
        if fo.startswith('Scavengers') or fo.startswith('other') or (fo=='' and k not in ROOT_COMMANDERS) or k.endswith('_scav') or k.startswith('scav') or k.startswith('raptor') or k.startswith('critter'): continue
        pre=k[:3]
        fac={'arm':'Armada','cor':'Cortex','leg':'Legion'}.get(pre)
        if not fac: continue
        desc=descs.get(k,'')
        tl=u['cp'].get('techlevel')
        if not tl:
            tl=3 if ('/T3' in fo or 'Gantry' in fo or 'Tech 3' in desc) else 2 if ('/T2' in fo or 'Tech 2' in desc or 'T2' in fo) else 1
        P=fo
        if 'Seaplane' in P or 'Aircraft' in P: cat='Air'
        elif 'Hover' in P: cat='Hover'
        elif 'Ship' in P or 'Sub' in P: cat='Naval'
        elif 'Bot' in P or 'Mech' in P: cat='Bots'
        elif 'Vehicle' in P or 'Tank' in P: cat='Vehicles'
        elif 'Building' in P or 'Defen' in P or 'Economy' in P or 'Utility' in P: cat='Buildings'
        else: cat=None
        isb = not u.get('speed') and not u.get('canfly')
        if isb: cat='Buildings'
        elif cat in (None,'Buildings'):
            cat='Air' if u.get('canfly') else 'Vehicles' if 'hover' not in str(u.get('movementclass','')).lower() else 'Hover'
            mc=str(u.get('movementclass','')).upper()
            if 'BOT' in mc: cat='Bots'
            elif 'BOAT' in mc or 'SHIP' in mc or 'UBOAT' in mc: cat='Naval'
            elif 'HOVER' in mc: cat='Hover'
        w=[]
        for wid,slot in u['wl'].items():
            wd=u['weapons'].get(slot.get('def','').lower())
            if not wd: continue
            wd=dict(wd); wd['onlytargetcategory']=slot.get('onlytargetcategory'); wd['badtargetcategory']=slot.get('badtargetcategory')
            dm=wd.get('dm',{}); wd['dmg']=dm.get('default'); wd['dv']=dm.get('vtol')
            if wd.get('weapontype') in('Shield',) or wd.get('name','').lower().startswith('dummy'): continue
            if dm0 := wd.get('dm'):
                if max(dm0.values())<=0: continue          # helper weapons (nuke launch, trajectory dummies) deal no damage
            elif not wd.get('range'): continue             # footstep and sound helpers
            w.append({'n':wd.get('name',slot.get('def')),'range':wd.get('range'),'dmg':wd.get('dmg') if wd.get('dmg') is not None else wd.get('dv'),'dd':wd.get('dmg'),'dm':{k:v for k,v in dm.items() if k!='default'} or None,'reload':wd.get('reloadtime'),'type':wd.get('weapontype'),'aoe':wd.get('areaofeffect'),'only':wd.get('onlytargetcategory'),'bad':wd.get('badtargetcategory'),'aa':wd.get('dmg') is None and wd.get('dv') is not None})
        # dedupe identical
        seen=[];ww=[]
        for x in w:
            if x not in seen: seen.append(x); x['count']=1; ww.append(x)
            else: ww[seen.index(x)]['count']+=1
        o={'id':k,'name':names[k],'desc':desc,'faction':fac,'tier':tl,'cat':cat,'folder':fo,
           'metal':u.get('metalcost'),'energy':u.get('energycost'),'bt':u.get('buildtime'),'hp':u.get('health'),
           'speed':u.get('speed'),'los':u.get('sightdistance'),'radar':u.get('radardistance'),'sonar':u.get('sonardistance'),
           'jam':u.get('radardistancejam'),'worker':u.get('workertime'),'fly':bool(u.get('canfly')),
           'build':u['build'],'weapons':ww,'emake':u.get('energymake'),'mmake':u.get('metalmake') or u['cp'].get('metal_extractor'),
           'estore':u.get('energystorage'),'mstore':u.get('metalstorage'),'size':[u.get('footprintx'),u.get('footprintz')],
           'water':u.get('maxwaterdepth'),'cloak':bool(u.get('cancloak')),'kamikaze':bool(u.get('kamikaze')),'upkeep':u.get('energyupkeep'),'cc':u['cp'].get('energyconv_capacity'),'ce':u['cp'].get('energyconv_efficiency'),'exp':True if k in exp else None,'expby':exp.get(k) or None,'ac':armor.get(k) if armor.get(k)!='standard' else None,'grp':u['cp'].get('unitgroup'),'extract':u.get('extractsmetal'),'mex':u['cp'].get('metal_extractor')}
        out.append(o)
    return out


def run(cache, out_path):
    out=parse(cache)
    open(out_path,'w',encoding='utf8').write('window.UNITS='+json.dumps(out,separators=(',',':'))+';')
    print(len(out),Counter(o['cat'] for o in out),Counter(o['faction'] for o in out),Counter(o['tier'] for o in out))


if __name__ == '__main__':
    run(sys.argv[1], sys.argv[2])
