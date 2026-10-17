"""Generate up to three mapped alternatives; never claim human entrance/crossing approval."""
import csv
import json
from backend.config import ROOT_DIR
from backend.scripts.build_simulation_data import walking_graph


def main():
    directory=ROOT_DIR/'data/reviewed'
    corridor=json.loads((directory/'corridor.json').read_text())
    bundle=json.loads((directory/'simulation_input.json').read_text())
    access,sources=walking_graph(corridor,max_walk_m=750,limit=3)
    rows,features=[],[]
    for development in bundle['inputs']['developments']:
        routes=access(development['longitude'],development['latitude'],development['id'])
        for rank,route in enumerate(routes,1):
            route['properties'].update(rank=rank,source_ids=[source['source_id'] for source in sources]+['ttc-gtfs'],review_note='Address and stop connectors are estimates. Entrance, legal crossings, railway barriers and temporary closures require human review.')
            features.append(route)
            rows.append(dict(development_id=development['id'],stop_id=route['properties']['stop_id'],walk_m=route['properties']['walk_m'],rank=rank,entrance_checked='',crossings_checked='',barriers_checked='',closures_checked='',reviewed_by='',reviewed_at='',decision='pending'))
    (directory/'walking_alternatives.geojson').write_text(json.dumps(dict(type='FeatureCollection',features=features),indent=2)+'\n')
    with (directory/'walking_review.csv').open('w',newline='') as output:
        writer=csv.DictWriter(output,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    print(json.dumps({'routes':len(features),'developments':len(bundle['inputs']['developments']),'review':'pending human sign-off; not activated in the model'}))


if __name__=='__main__':main()
