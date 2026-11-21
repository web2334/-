"""
Собирает все GLB-модели «Ворс» в один редактируемый .blend.

Запуск (Blender 4.x):
  blender --background --python scripts/blender/import_models.py -- models-src assets/vors-models.blend

Каждая модель попадает в свою коллекцию; модели разнесены по оси X.
Узлы Face / Eye_L / Eye_R / Arm_L / Arm_R / SpeechAnchor / EyeAnchor и анимации
Blink / Wave / Hop сохраняются — сайт опирается на эти имена.
После правок экспортируйте модель обратно: File → Export → glTF 2.0 (.glb),
затем выполните `node scripts/optimize-models.mjs` (или положите файл в models-src/).
"""
import os
import sys

import bpy  # noqa: E402  (доступен только внутри Blender)

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
src = argv[0] if len(argv) > 0 else "models-src"
out = argv[1] if len(argv) > 1 else "assets/vors-models.blend"

bpy.ops.wm.read_factory_settings(use_empty=True)
files = sorted(f for f in os.listdir(src) if f.endswith(".glb"))
for i, name in enumerate(files):
    coll = bpy.data.collections.new(os.path.splitext(name)[0])
    bpy.context.scene.collection.children.link(coll)
    layer = bpy.context.view_layer.layer_collection.children[coll.name]
    bpy.context.view_layer.active_layer_collection = layer
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(src, name))
    for obj in set(bpy.data.objects) - before:
        if obj.parent is None:
            obj.location.x += i * 3.0

os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out))
print(f"Сохранено: {out} ({len(files)} моделей)")
