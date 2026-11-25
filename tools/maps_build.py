"""Turn the official maps metadata into site/maps.js (certified maps only)."""
import json, sys


def run(S, OUT):
    L=json.load(open(S+'/lobby_maps.json')); live={m['fileName']:m['downloadURL'] for m in json.load(open(S+'/live_maps.json'))}
    out=[]
    for m in L:
        if not m.get('certified'): continue
        o={'id':m['filename'],'n':m['displayName'],'a':m.get('author',''),'d':(m.get('description') or '').strip(),
           'w':m['mapWidth'],'h':m['mapHeight'],'p':[m['playerCountMin'],m['playerCountMax']],
           'tg':m.get('tags',[]),'tr':m.get('terrain',[]),'ls':m.get('mapLists',[]),
           'wd':[m.get('windMin'),m.get('windAvg'),m.get('windMax')],'td':m.get('tidalStrength'),
           'img':(m.get('images') or {}).get('preview'),'dl':live.get(m['filename'])}
        o['bx']=[{'m':s['maxPlayersPerStartbox'],'b':[[[round(p['x']),round(p['y'])] for p in b['poly']] for b in s['startboxes']]} for s in m.get('startboxesSet',[])]
        sp=m.get('startPos')
        if sp:
            o['sp']={'pos':{k:[v['x'],v['y']] for k,v in sp['positions'].items()},
                     'tm':[{'n':t['playersPerTeam'],'s':[[[x['spawnPoint'],x.get('role')] for x in sd['starts']] for sd in t['sides']]} for t in sp.get('team',[])]}
        out.append(o)
    open(OUT,'w',encoding='utf8').write('window.MAPS='+json.dumps(out,separators=(',',':'),ensure_ascii=False)+';')
    print(len(out))


if __name__ == '__main__':
    run(sys.argv[1], sys.argv[2])
