"""Prepare the supplied 500 Dundas GLB for the Mapbox model loader."""
from pathlib import Path
from prepare_dundas_761_model import prepare

if __name__ == '__main__':
    models = Path(__file__).resolve().parents[1] / 'public' / 'models'
    count = prepare(models / 'dundas_500.glb', models / 'dundas_500.mapbox.glb')
    print(f'Prepared 500 Dundas model: added indices to {count} primitives.')
