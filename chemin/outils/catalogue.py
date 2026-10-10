# Le chemin : le catalogue des objets. À partir de collections libres (CC0), dézippées, une par sous-dossier : pour chaque
# modèle retenu, son libellé tiré de son nom, son rôle, les lieux où il se pose, sa taille réelle et le fichier copié dans objets/.
# Kenney arrive en .glb ; les autres passent d’abord par normaliser.mjs, et les poses par poser.mjs (voir LISEZMOI.md).
# python3 chemin/outils/catalogue.py <dossier des collections> [<autre dossier>…]
import os, sys, re, json, glob, shutil, struct
sys.path.insert(0, os.path.dirname(__file__))
from boites import boite

ICI = os.path.dirname(os.path.abspath(__file__)); RACINE = os.path.dirname(ICI)
ARGS = sys.argv[1:] # --seulement pictos,archipel : rebâtir ces collections-là, et garder les autres telles qu’elles sont, déjà allégées
SEULS = set(ARGS[1].split(',')) if ARGS[:1] == ['--seulement'] and len(ARGS) > 1 else None
SOURCES = (ARGS[2:] if SEULS else ARGS) or ['kits'] # un kit se cherche dans chaque dossier, dans l’ordre

# chaque collection : son échelle vers des mètres, son rôle par défaut, ses lieux, ce qu’on écarte, et les exceptions par motif
KITS = {
  'furniture-kit': dict(echelle=1.95, role='objet', lieux=['interieur'], modules=r'^(wall|floor|doorway|stairs|paneling)'),
  'nature-kit': dict(echelle=3.5, role='decor', lieux=['foret', 'champs'], modules=r'^(cliff|ground|path|bridge|platform|crops_dirt)',
    roles={r'^(tent|campfire|canoe|bed|sign|statue|pot|log_stack)': 'objet', r'^fence': 'raccord'},
    lieux_par={r'palm|cactus|lily|canoe': ['rivage'], r'^crop': ['champs'], r'^(statue|pot)': ['champs', 'village']}),
  'city-kit-suburban': dict(echelle=8, role='batiment', lieux=['village'], modules=r'^(driveway|path)',
    roles={r'^tree': 'decor', r'^(fence|planter)': 'raccord'}),
  'city-kit-commercial': dict(echelle=8, role='batiment', lieux=['village'], modules=r'^(low-detail|detail-(awning|overhang))',
    roles={r'^detail-parasol': 'objet'}),
  'food-kit': dict(echelle=0.45, role='petit', lieux=['interieur', 'village'], exclus=r'knife|slicer|fork|spatula|chopstic|wrapper|bones|fries-empty|can-open|frikandel'),
  'car-kit': dict(echelle=1.3, role='objet', lieux=['village'], exclus=r'^(debris|wheel|box|cone)'),
  'watercraft-kit': dict(echelle=1.2, role='objet', lieux=['rivage'], exclus=r'^(arrow|gate|ramp|cargo)', roles={r'^buoy': 'raccord'}),
  'holiday-kit': dict(echelle=1.25, role='objet', lieux=['interieur', 'village', 'champs'], modules=r'^(cabin|floor)', saison='hiver'),
  'survival-kit': dict(echelle=3, role='objet', lieux=['foret', 'champs'], modules=r'^(floor|metal-panel|structure|patch|grass|resource)',
    exclus=r'axe|pickaxe|tool-hoe|hammer', roles={r'^(rock)': 'decor', r'^(fence|signpost)': 'raccord'}),
  'fantasy-town-kit': dict(echelle=1.9, role='objet', lieux=['village', 'champs'],
    modules=r'^(roof|wall|road|planks|pillar|poles|chimney|balcony|overhang|stairs|fountain-(corner|edge|curved|center)|hedge-(curved|large-curved)|blade|wheel)',
    roles={r'^(tree|rock)': 'decor', r'^(hedge|fence|lantern|banner)': 'raccord'}),
  'cube-pets': dict(echelle=0.5, role='animal', lieux=['champs', 'village', 'foret']),
  'mini-characters': dict(echelle=2.2, role='personne', lieux=['village', 'interieur', 'champs', 'foret', 'rivage'], exclus=r'defibrillator|mask'),
  'mini-market': dict(echelle=1.6, role='objet', lieux=['interieur'], modules=r'^(floor|wall|column|fence)', exclus=r'character'),
  'pirate-kit': dict(echelle=2.2, role='objet', lieux=['rivage'],
    modules=r'^(castle|structure|platform|tower|mast|patch|hole|grass)', exclus=r'cannon|flag-pirate|ship-ghost|ship-pirate|ship-wreck|tool-shovel',
    roles={r'^(palm|rocks)': 'decor', r'^flag': 'raccord'}),
  'train-kit': dict(echelle=1.4, role='objet', lieux=['village'], modules=r'^(railroad|spline|track|train-connector)'),
}
# Les autres collections libres (CC0) : KayKit (Kay Lousberg), Quaternius, et quelques auteurs d’OpenGameArt ; puis les choses
# de l’archipel, et les poses. garder : les seuls modèles retenus ; hauteurs : la hauteur réelle de certains, en mètres, quand
# l’échelle de la collection n’est pas la même partout ; enfoui : le modèle a un socle sous son origine, qu’on enterre.
KITS.update({
  'kaykit-city-builder-bits': dict(echelle=4.8, role='objet', lieux=['village'],
    garder=r'^(building_[A-H]_withoutBase|bench|box_A|bush|car_\w+|dumpster|firehydrant|streetlight|trafficlight_A|trash_A|watertower)$',
    roles={r'^building': 'batiment', r'^bush': 'decor'},
    hauteurs={r'^car_': 1.5, r'^firehydrant': .8, r'^trafficlight': 3, r'^watertower': 14, r'^dumpster': 1.3, r'^trash': .9, r'^box': .5}),
  'kaykit-furniture-bits': dict(echelle=.75, role='objet', lieux=['interieur'], exclus=r'_B$|_wood$|stripes_B',
    roles={r'^(book|pictureframe_(small|standing)|pillow|lamp_table|cactus_small)': 'petit'}),
  'kaykit-halloween-bits': dict(echelle=1, role='objet', lieux=['village', 'interieur'], saison='automne',
    garder=r'^(candle\w*|lantern_\w+|post_lantern|pumpkin_\w+|tree_dead_\w+|tree_pine_(orange|yellow)_\w+|bench|bench_decorated|arch|arch_gate|shrine_candles)$',
    roles={r'^(candle|lantern_hanging|pumpkin)': 'petit', r'^tree': 'decor'}, lieux_par={r'^tree': ['foret'], r'^pumpkin': ['champs', 'village']},
    hauteurs={r'^candle_triple': .35, r'^candle': .25, r'^lantern': .5, r'^post_lantern': 2.4, r'^pumpkin\w*_small': .3, r'^pumpkin': .45,
              r'^tree_\w+_large': 7, r'^tree_\w+_medium': 5, r'^tree_\w+_small': 3, r'^arch': 3.5, r'^shrine': 1.6}),
  'kaykit-holiday-bits': dict(echelle=.8, role='petit', lieux=['interieur', 'village'], saison='hiver',
    garder=r'^(basketball|football|bell|bell_decorated|candycane_small|christmas_tree|christmas_tree_decorated|chair_large_red|footstool_red|cookie|gingerbread_house_decorated|gingerbread_man|hot_chocolate_decorated|lantern_decorated|milk|mistletoe_A|plate_decorated_A|present_[A-F]_red|present_[BD]_blue|present_C_green|present_sphere_A_red|snowball|snowball_pile|snowman_[AB]|stool|train_locomotive|train_wagon|wreath)$',
    roles={r'^(christmas_tree|snowman|snowball_pile|chair|stool|train)': 'objet'}, lieux_par={r'^(snowman|snowball)': ['village', 'champs']},
    hauteurs={r'^basketball': .25, r'^football': .22, r'^bell': .25, r'^candycane': .2, r'^christmas_tree': 2.4, r'^cookie': .05, r'^gingerbread_house': .3,
              r'^gingerbread_man': .15, r'^hot_chocolate': .12, r'^lantern': .4, r'^milk': .25, r'^mistletoe': .3, r'^plate': .03, r'^present': .35,
              r'^snowball$': .2, r'^snowball_pile': .5, r'^snowman': 1.6, r'^wreath': .5, r'^stool': .45, r'^chair': 1, r'^footstool': .4, r'^train': .35}),
  'kaykit-forest': dict(echelle=1.9, role='decor', lieux=['foret', 'champs'], garder=r'^(Tree_[1-4]_A|Tree_Bare_[12]_A|Bush_[1-4]_A|Rock_[1-3]_A|Grass_[12]_A)_Color1$',
    hauteurs={r'^Tree_Bare': 6, r'^Tree': 7, r'^Bush': .9, r'^Rock': 1, r'^Grass': .5}),
  'kaykit-medieval': dict(echelle=4.3, role='objet', lieux=['village', 'champs'],
    garder=r'^(building_(castle|church|home_A|home_B|lumbermill|market|mine|tavern|tower_A|watermill|well|windmill|blacksmith)_blue|building_(bridge_A|grain|destroyed|scaffolding)|cloud_(big|small)|mountain_[AB]_grass_trees|mountain_C|hills_A_trees|trees_A_large|tree_single_A|waterlily_A|rock_single_A|barrel|bucket_water|crate_A_big|flag_red|ladder|sack|tent|wheelbarrow|resource_lumber|resource_stone|pallet)$',
    roles={r'^building_(?!well|bridge)': 'batiment', r'^cloud': 'ciel', r'^(mountain|hills|trees|tree)': 'decor', r'^(waterlily|sack|bucket)': 'petit'},
    lieux_par={r'^mountain': ['montagne'], r'^(waterlily|building_watermill)': ['rivage', 'champs'], r'^(trees|tree)': ['foret']},
    hauteurs={r'castle': 18, r'church': 14, r'home': 7, r'tavern': 9, r'market': 6, r'mine': 6, r'lumbermill': 8, r'watermill': 9, r'building_well': 2.5,
              r'windmill': 12, r'blacksmith': 7, r'tower_A': 12, r'bridge': 3, r'grain': 6, r'destroyed': 5, r'scaffolding': 6, r'^cloud': 4, r'^mountain': 30,
              r'^hills': 10, r'^trees': 7, r'^tree_single': 6, r'^waterlily': .1, r'^rock': .8, r'^barrel': .9, r'^bucket': .4, r'^crate': 1, r'^flag': 3,
              r'^ladder': 3, r'^sack': .6, r'^tent': 2.5, r'^wheelbarrow': .8, r'^resource': .6, r'^pallet': .2}),
  'kaykit-mixed-bag-1': dict(echelle=1, role='petit', lieux=['interieur', 'village'],
    garder=r'^(chain_anchor|chicken_plushie_A|circus_tent|comicbook_A|comicbooks_stacked|flax_flower_A|guitar_[AB]|idol_A|instantcamera|instantcamera_picture_A|mining_helmet|puzzlecube_complete|rollerskate_pair|taco|umbrella_(blue|yellow)|waterbottle_A|woodstove)$',
    roles={r'^circus_tent': 'batiment', r'^(woodstove|umbrella|guitar|chain_anchor)': 'objet'}, lieux_par={r'^chain_anchor': ['rivage'], r'^circus': ['village', 'champs']},
    hauteurs={r'^chain_anchor': .9, r'^chicken': .3, r'^circus': 9, r'^comicbooks': .2, r'^comicbook': .3, r'^flax': .5, r'^guitar': 1, r'^idol': .35,
              r'^instantcamera_picture': .1, r'^instantcamera': .12, r'^mining': .25, r'^puzzlecube': .06, r'^rollerskate': .3, r'^taco': .06, r'^umbrella': 1,
              r'^waterbottle': .25, r'^woodstove': 1.5}),
  'kaykit-resource-bits': dict(echelle=1, role='petit', lieux=['village', 'champs'],
    garder=r'^(Gold_Bars_Stack_Large|Silver_Bars|Gold_Nuggets|Fuel_A_Barrel|Fuel_A_Jerrycan|Pallet_Wood_Covered_A|Parts_Cog|Parts_Pile_Large|Stone_Bricks_Stack_Large|Stone_Chunks_Large|Textiles_Stack_Large_Colored|Textiles_A|Wood_Log_Stack|Wood_Planks_Stack_Large)$',
    roles={r'^(Fuel_A_Barrel|Pallet|Parts_Pile|Stone|Wood)': 'objet'},
    hauteurs={r'^Gold_Bars': .3, r'^Silver_Bars': .1, r'^Gold_Nuggets': .1, r'^Fuel_A_Barrel': .9, r'^Fuel_A_Jerrycan': .45, r'^Pallet': .5, r'^Parts_Cog': .4,
              r'^Parts_Pile': .8, r'^Stone_Bricks': .8, r'^Stone_Chunks': .6, r'^Textiles_Stack': .6, r'^Textiles_A': .4, r'^Wood_Log': 1, r'^Wood_Planks': .6}),
  'kaykit-restaurant-bits': dict(echelle=1, role='petit', lieux=['interieur'],
    garder=r'^(bowl|chair_A|crate_(carrots|tomatoes|potatoes)|cuttingboard|dishrack_plates|food_(burger|dinner|stew)|food_ingredient_(cheese|ham|steak|tomato|lettuce|onion|potato|carrot)|fridge_A|jar_A_large|ketchup|menu|mustard|oven|pan_A|plate|pot_A_stew|pot_large|stove_multi|table_round_A_decorated|papertowel)$',
    roles={r'^(chair|fridge|oven|stove|table)': 'objet'},
    hauteurs={r'^bowl': .08, r'^chair': .9, r'^crate': .35, r'^cuttingboard': .03, r'^dishrack': .3, r'^food_ingredient': .1, r'^food': .1, r'^fridge': 1.8,
              r'^jar': .2, r'^ketchup': .2, r'^menu': .25, r'^mustard': .2, r'^oven': .9, r'^pan': .06, r'^plate': .03, r'^pot': .2, r'^stove': .9, r'^table': .75,
              r'^papertowel': .25}),
  'kaykit-space-base-bits': dict(echelle=1, role='objet', lieux=['reve'],
    garder=r'^(basemodule_A|basemodule_garage|cargo_A_stacked|containers_A|drill_structure|lander_A|solarpanel|spacetruck|windturbine_tall|windturbine_low|structure_tall)$',
    roles={r'^(basemodule|drill|structure|windturbine)': 'batiment'}, lieux_par={r'^(solarpanel|windturbine)': ['champs']},
    hauteurs={r'^basemodule_A': 3.5, r'^basemodule_garage': 4, r'^cargo': 2.5, r'^containers': 2.6, r'^drill': 10, r'^lander': 6, r'^solarpanel': 1.6,
              r'^spacetruck': 3, r'^windturbine_tall': 40, r'^windturbine_low': 15, r'^structure': 12}),
  'kaykit-board-game-bits': dict(echelle=1, role='petit', lieux=['interieur'],
    garder=r'^(D6_A|D20_red|coin_gold|coin_10_gold|hourglass|pawn_A_red|meeple_blue|domino_tile_2-5)$',
    hauteurs={r'^D6': .1, r'^D20': .1, r'^coin_gold': .03, r'^coin_10': .1, r'^hourglass': .25, r'^pawn': .1, r'^meeple': .08, r'^domino': .05}),
  'kaykit-adventurers': dict(echelle=1, role='petit', lieux=['interieur', 'village'], garder=r'^(mug_full|mug_empty|spellbook_closed|spellbook_open)$',
    hauteurs={r'^mug': .15, r'^spellbook': .25}),
  'space-kit': dict(echelle=1, role='objet', lieux=['reve'],
    garder=r'^(alien|astronautA|astronautB|craft_cargoA|craft_racer|craft_speederA|craft_miner|rover|satelliteDish_large|satelliteDish|meteor|meteor_detailed|rock_crystals|desk_computer|desk_computerScreen|desk_chair)$',
    roles={r'^(alien|astronaut)': 'personne'}, lieux_par={r'^desk': ['interieur'], r'^satelliteDish': ['champs', 'village']},
    hauteurs={r'^alien': 1.2, r'^astronaut': 1.8, r'^craft': 4, r'^rover': 2.5, r'^satelliteDish_large': 6, r'^satelliteDish': 3, r'^meteor': 2, r'^rock_crystals': 1,
              r'^desk_computerScreen': .5, r'^desk_computer': .8, r'^desk_chair': 1}),
  'coaster-kit': dict(echelle=1, role='objet', lieux=['village'], garder=r'^(stall-(drinks|food|information|toilets)|park-entrance|coaster-train-front)$',
    hauteurs={r'^stall': 3, r'^park-entrance': 5, r'^coaster': 1.6}),
  'mini-arcade': dict(echelle=1, role='objet', lieux=['interieur', 'village'],
    garder=r'^(air-hockey|arcade-machine|basketball-game|cash-register|claw-machine|dance-machine|pinball|prize-wheel|vending-machine|character-gamer)$',
    roles={r'^cash': 'petit', r'^character': 'personne'},
    hauteurs={r'^arcade': 1.8, r'^air-hockey': 1, r'^claw': 2, r'^pinball': 1.6, r'^vending': 1.9, r'^cash': .4, r'^prize': 2.5, r'^dance': 1.8, r'^basketball': 2.5,
              r'^character': 1.6}),
  'mini-skate': dict(echelle=1, role='objet', lieux=['village'], garder=r'^(skateboard|half-pipe|character-skate-(boy|girl))$',
    roles={r'^character': 'personne', r'^skateboard': 'petit'}, hauteurs={r'^skateboard': .12, r'^half-pipe': 2.5, r'^character': 1.5}),
  'racing-kit': dict(echelle=1, role='objet', lieux=['village'], garder=r'^(raceCarRed|raceCarGreen|grandStandCovered|flagCheckers|billboard|tentClosed)$',
    hauteurs={r'^raceCar': 1.2, r'^grandStand': 6, r'^flag': 2, r'^billboard': 4, r'^tent': 3}),
  'toy-car-kit': dict(echelle=1, role='objet', lieux=['village'], garder=r'^vehicle-(monster-truck|vintage-racer|truck|suv)$',
    hauteurs={r'monster': 3, r'vintage': 1.3, r'truck$': 3, r'suv': 1.8}),
  'city-kit-industrial': dict(echelle=1, role='batiment', lieux=['village'],
    garder=r'^(building-[a-h]|chimney-large|detail-tank-large|shipping-container-[abc]|solar-panel-landscape-group|water-tower|windmill|windmill-low)$',
    roles={r'^(shipping|solar|detail)': 'objet'}, lieux_par={r'^(windmill|solar)': ['champs']},
    hauteurs={r'^building': 12, r'^chimney': 20, r'^detail-tank': 6, r'^shipping': 2.6, r'^solar': 1.5, r'^water-tower': 15, r'^windmill$': 40, r'^windmill-low': 15}),
  'platformer-kit': dict(echelle=1, role='petit', lieux=['village', 'champs', 'interieur'],
    garder=r'^(chest|coin-gold|door-large-open|flag|heart|jewel|key|ladder|lock|sign|star|tree-snow|tree-pine-snow|barrel|crate)$',
    roles={r'^(door|flag|ladder|sign|barrel|crate|chest)': 'objet', r'^tree': 'decor'}, lieux_par={r'^tree': ['foret', 'montagne']},
    hauteurs={r'^chest': .6, r'^coin': .05, r'^door': 2.1, r'^flag': 2, r'^heart': .3, r'^jewel': .1, r'^key': .1, r'^ladder': 2.5, r'^lock': .1, r'^sign': 1.2,
              r'^star': .3, r'^tree-snow': 5, r'^tree-pine-snow': 6, r'^barrel': .9, r'^crate': .8}),
  'retro-urban-kit': dict(echelle=1, role='objet', lieux=['village'],
    garder=r'^(truck-(green|grey|flat)|detail-bench|detail-dumpster-closed|detail-light-single|scaffolding-structure|tree-park-large)$', roles={r'^tree': 'decor'},
    hauteurs={r'^truck': 3, r'^detail-bench': .5, r'^detail-dumpster': 1.3, r'^detail-light': 4, r'^scaffolding': 4, r'^tree': 7}),
  'q-food': dict(echelle=.1, role='petit', lieux=['interieur', 'village'],
    exclus=r'(?i)knife|fork|spoon|chopstick|fishbone|burn|_raw|uncooked|_empty|sliced|_slice|singles|plate|patty|burger_bread|hotdog_bun|tentacle|bottle2|peanutbutter_2|cookingpot2$|donut[234]|icecream_[234]|cone2|popsicle_(multiple|strawberry)|apple_green|sushi_nigiri2|sashimi_salmon2|sushi_roll2|egg_whole_white',
    hauteurs={r'^Bottle': .3, r'^Pizza$': .03, r'^Soda': .2}),
  'q-interior': dict(echelle=.5, role='objet', lieux=['interieur'],
    garder=r'^(Bathroom_(Bathtub|Shower1|Sink|Toilet|ToiletPaper|Towel|WashingMachine|Mirror1)|Bed_(Bunk|King|Single)|Bookshelf|Chair_[13]|Couch_(Large1|Medium1|Small1)|Curtains_Double|Door_(1|Double)|Drawer_[13]|Fireplace|Houseplant_[12357]|Kitchen_(Fridge|Oven|Sink|Cabinet1)|Light_(Chandelier|Desk|Floor1|Stand1)|NightStand_1|Shelf_Large|Stool|Table_Round(Large|Small)|Trashcan_Green|Window_(Large1|Round1|Small1))$',
    roles={r'^(Bathroom_(ToiletPaper|Towel)|Light_Desk|Houseplant_[13])$': 'petit'}),
  'q-furniture': dict(echelle=.9, role='objet', lieux=['interieur'],
    garder=r'^(Bed|BedKing|BookCaseBooks|BookCaseLargeBooks|Chair|ChairCushioned|Closet|CoffeeTable|Lamp|Plant|Sofa|SofaLong|Stool|Table|Vase|Vase2)$', roles={r'^Vase': 'petit'}),
  'q-survival': dict(echelle=.17, role='petit', lieux=['foret', 'champs'],
    garder=r'^(Backpack|Bandages|Battery_Big|Bonfire_Fire|Can_Closed|Compass_Open|FirstAidKit_Hard|GasCan|Match_Fire|Matchbox|Pan|Phone|Pot|PropaneTank|Radio|Raft|Shovel|Tent|Torch|Trashcan|WaterBottle_1|WoodLog|WoodenTorch_Fire)$',
    roles={r'^(Bonfire|Tent|Trashcan|PropaneTank|Raft|Shovel|WoodenTorch)': 'objet'}, lieux_par={r'^(Phone|Radio|Battery|Trashcan|Bandages|FirstAid)': ['interieur', 'village'], r'^Raft': ['rivage']},
    hauteurs={r'^Backpack': .5, r'^Bandages': .1, r'^Battery': .06, r'^Bonfire': 1, r'^Can': .12, r'^Compass': .06, r'^FirstAid': .25, r'^GasCan': .45, r'^Match_': .05,
              r'^Matchbox': .05, r'^Pan': .06, r'^Phone': .15, r'^Pot': .2, r'^PropaneTank': .6, r'^Radio': .25, r'^Raft': .4, r'^Shovel': 1.2, r'^Tent': 2,
              r'^Torch': .25, r'^Trashcan': 1.1, r'^WaterBottle': .3, r'^WoodLog': .4, r'^WoodenTorch': 1.2}),
  'q-buildings': dict(echelle=5, role='batiment', lieux=['village']),
  'textured-buildings': dict(echelle=4, role='batiment', lieux=['village'], garder=r'^(1Story_GableRoof|1Story_Sign|2Story_Balcony|2Story_Sign|3Story_Slim|4Story|4Story_Center|6Story_Stack)$'),
  'q-ships': dict(echelle=6, role='objet', lieux=['rivage']),
  'q-desert': dict(echelle=1, role='decor', lieux=['desert'], garder=r'^(Cactus|Cactus2|Cactus3|CactusWithSombrero|DeadTree|BigPalmTree|SmallPalmTree|Monument|Pyramid|Scorpion)$',
    roles={r'^Pyramid': 'batiment', r'^Monument': 'objet', r'^Scorpion': 'animal'},
    hauteurs={r'^Cactus$': 1.5, r'^Cactus2': 2, r'^Cactus3': 2.5, r'^CactusWith': 2, r'^DeadTree': 4, r'^BigPalm': 9, r'^SmallPalm': 4, r'^Monument': 6, r'^Pyramid': 40,
              r'^Scorpion': .1}),
  'q-crops': dict(echelle=1, role='objet', lieux=['champs'], garder=r'^(Apple|Orange|Bamboo|Corn|Wheat|Rice|Pumpkin|Watermelon|Tomato|Carrot|Lettuce|BushBerries|Cactus|PalmTree|Mushroom|Beet)_4$',
    roles={r'^(Apple|Orange|Bamboo|PalmTree)': 'decor'}, lieux_par={r'^(Bamboo|PalmTree)': ['tropiques'], r'^Cactus': ['desert'], r'^Mushroom': ['foret']},
    hauteurs={r'^(Apple|Orange)': 4, r'^Bamboo': 5, r'^Corn': 2, r'^Wheat': 1, r'^Rice': .8, r'^Pumpkin': .5, r'^Watermelon': .4, r'^Tomato': 1.2, r'^Carrot': .4,
              r'^Lettuce': .3, r'^BushBerries': 1.2, r'^Cactus': 1.5, r'^PalmTree': 5, r'^Mushroom': .2, r'^Beet': .4}),
  'q-nature': dict(echelle=1, role='decor', lieux=['foret', 'champs'],
    garder=r'^(BirchTree_[12]|BirchTree_Autumn_1|BirchTree_Snow_1|CommonTree_[123]|CommonTree_Autumn_[12]|CommonTree_Snow_1|PineTree_[12]|PineTree_Snow_[12]|PineTree_Autumn_1|Willow_[12]|Willow_Autumn_1|Willow_Snow_1|CactusFlower_1|Cactus_1|Flowers|Lilypad|Rock_Moss_1|Rock_Snow_1|TreeStump_Moss|WoodLog_Moss|Bush_1|Bush_Snow_1|BushBerries_1|Plant_[13])$',
    roles={r'^(Flowers|Lilypad|Plant)': 'objet'}, lieux_par={r'_Snow': ['montagne', 'foret'], r'^Cactus': ['desert'], r'^Lilypad': ['rivage'], r'^Willow': ['rivage', 'champs']},
    saisons={r'_Autumn': 'automne', r'_Snow': 'hiver'},
    hauteurs={r'^BirchTree': 9, r'^CommonTree': 7, r'^PineTree': 9, r'^Willow': 7, r'^Cactus': 2, r'^Flowers': .4, r'^Lilypad': .05, r'^Rock': 1, r'^TreeStump': .5,
              r'^WoodLog': .5, r'^Bush': 1, r'^Plant': .5}),
  'savane': dict(echelle=1, role='decor', lieux=['savane'],
    garder=r'^(AfricaTree_01|AfricanBoabab_01|acacciaTree_01|umbrellaAcaciaFul_01|umbreallAcacia_02|africanMahogany_0[12]|africanThorn[Bb]ush_0[12]|africaBush_01|af_deadTree_01|AfricanWheatGrass_01|africaGrass_0[12]|waterReeds_01|yellowBush_01|Shack0[12]|Kennel01|PoleBuilding01|AfricaDock01|genericTree_01|africaRock_0[56]|stoneGroup_01)$',
    roles={r'^(Shack|Kennel|PoleBuilding)': 'batiment', r'^AfricaDock': 'objet'}, lieux_par={r'^(waterReeds|AfricaDock)': ['rivage', 'savane']},
    hauteurs={r'Boabab': 14, r'^acaccia': 9, r'^umbrellaAcacia': 10, r'^umbreallAcacia': 6, r'Mahogany': 12, r'^AfricaTree': 10, r'^genericTree': 9, r'Thorn': 3,
              r'^africaBush|^yellowBush': 2, r'^af_deadTree': 2, r'WheatGrass': 1.5, r'^africaGrass': 1, r'^waterReeds': 2, r'^Shack': 4, r'^Kennel': 4,
              r'^PoleBuilding': 5, r'^AfricaDock': 2, r'^africaRock': 5, r'^stoneGroup': .6}),
  'tropiques': dict(echelle=1, role='decor', lieux=['tropiques'],
    garder=r'^(Bamboo01|Bamboo_02|Banana0[12]|BeachPalm01|BirdNestPlant01|CecropiaTree01|CiabaTree_01|CopalTree01|CoconutBrown|CoconutGreen|ElephantEar|JungleHut0[12]|Kelp_01|Palm0[123]|QueensPalm01|ReefBase01|SeaPlant_0[12]|TropicFern01|Tropical_Jetty0[12]|BeachGrass01|Phila01)$',
    roles={r'^JungleHut': 'batiment', r'^Coconut': 'petit', r'^Tropical_Jetty': 'objet', r'^(Kelp|ReefBase|SeaPlant)': 'eau'},
    lieux_par={r'^(Tropical_Jetty|BeachPalm|BeachGrass|Kelp|ReefBase|SeaPlant)': ['rivage', 'tropiques']},
    hauteurs={r'^Bamboo01': 10, r'^Bamboo_02': 4, r'^Banana': 5, r'^BeachPalm': 3, r'^BirdNest': 1.5, r'^Cecropia': 12, r'^Ciaba': 14, r'^Copal': 12, r'^Coconut': .25,
              r'^ElephantEar': 1.5, r'^JungleHut': 7, r'^Kelp': 2, r'^Palm': 10, r'^QueensPalm': 8, r'^ReefBase': 2, r'^SeaPlant': 1.5, r'^TropicFern': 1.2,
              r'^Tropical_Jetty': 3, r'^BeachGrass': .5, r'^Phila': 1}),
  'mali': dict(echelle=.6, role='batiment', lieux=['desert', 'savane'], enfoui=True,
    garder=r'^mali_(house_[1-4]|temple|market|farmstead|defense_tower|sentry_tower|fortress|library|storehouse|wonder|civic_center)$'),
  'maya': dict(echelle=1, role='objet', lieux=['reve'], hauteurs={r'^mayan': 20, r'^chinagong': 2.5, r'^merchant': 3},
    roles={r'^mayan': 'batiment'}, lieux_par={r'^mayan': ['tropiques'], r'^merchant': ['village', 'desert']}),
  'q-transport': dict(echelle=1, role='objet', lieux=['village'], exclus=r'^TrafficSign',
    hauteurs={r'Bicycle': 1, r'^Ambulance': 2.6, r'^Bus': 3.2, r'^SchoolBus': 3, r'^Taxi': 1.5, r'^TrafficCone': .7, r'^TrafficLight': 3, r'^Train': 4}),
  'vehicules': dict(echelle=1, role='objet', lieux=['village'], roles={r'^avion-(jouet|leger|ligne)': 'ciel', r'^avion-papier': 'petit'}, lieux_par={r'^avion': ['reve']},
    hauteurs={r'^avion-jouet': 3, r'^avion-leger': 2.5, r'^avion-ligne': 12, r'^avion-papier': .05, r'^moto': 1.1, r'Firetruck': 3.3, r'Limousine': 1.5, r'Roadster': 1.3,
              r'Truck': 4, r'Van': 2.2}),
  'objets-oga': dict(echelle=1, role='petit', lieux=['interieur'], roles={r'^chameau': 'animal', r'^ecole': 'batiment', r'^(drumset|rake)': 'objet'},
    lieux_par={r'^chameau': ['desert'], r'^ecole': ['village'], r'^rake': ['champs']},
    hauteurs={r'^chameau': 2.1, r'^chess_king': .1, r'^chess_knight': .06, r'^drumset': 1.2, r'^ecole': 12, r'^electric_guitar': .35, r'^horseshoe': .02, r'comb': .2,
              r'cup': .1, r'pencil': .18, r'scissors': .2, r'toothbrush': .19, r'^rake': 1.6, r'^stylo': .01, r'^teapot': .18, r'^wine_glass': .18}),
  'quaternius-farm': dict(echelle=1, role='batiment', lieux=['champs'], roles={r'^(Well|Fence)': 'objet'},
    hauteurs={r'^Barn': 7, r'^BigBarn': 9, r'^ChickenCoop': 2.5, r'^OpenBarn': 5, r'^Silo_House': 10, r'^Silo': 12, r'^SmallBarn': 5, r'Windmill': 12,
              r'^WaterTower': 12, r'^Well': 2.5, r'^Fence': 1}),
  'archipel': dict(echelle=1, role='objet', lieux=['champs', 'village'],
    roles={r'^bete': 'animal', r'^oiseau|^nuage': 'ciel', r'^(phare|maison)': 'batiment', r'^(fleurs|arbre|ronce|baies)': 'decor'},
    lieux_par={r'^(phare|bete-crabe|oiseau-(mouette|goeland|fou|fregate))': ['rivage'], r'maison-tropique': ['tropiques'], r'maison-neige': ['montagne'],
               r'maison-automne|bete-(renard|chevreuil|lievre|rougegorge)|arbre': ['foret'], r'^(maison-volets|banc|puits)': ['village'], r'^cairn|^menhir': ['champs', 'montagne']},
    saisons={r'maison-automne': 'automne', r'maison-neige': 'hiver'}),
  # les pictos : des emoji de Twemoji (CC BY 4.0, pas CC0 : voir objets/LISEZMOI.txt), extrudés en panneaux sur un piquet par
  # pictos.mjs, déjà à leur taille ; ils ne disent aucun lieu
  'pictos': dict(echelle=1, role='picto', lieux=[]),
  'poses': dict(echelle=1, role='personne', lieux=['village', 'champs', 'foret', 'rivage', 'interieur'],
    roles={r'^(bete|galop|mange|danse-cube|course-cube|marche-dog|dino)': 'animal', r'^vol-': 'ciel', r'^nage-': 'eau'},
    lieux_par={r'^dino': ['reve'], r'^bete-(cow|horse|llama|pig|sheep)|^galop|^mange': ['champs'], r'^bete-(wolf|red-fox)': ['foret'], r'^bete-zebra': ['savane'],
               r'^nage-|^peche': ['rivage'], r'^(dort|assis-chaise|bricole|fauteuil)': ['interieur', 'champs', 'village'], r'^creuse': ['champs']}),
})
# les mêmes modèles, autrement : une personne de dos, qui regarde le paysage, c’est « le dos ». Même fichier, un autre nom,
# et un demi-tour (tourne, en degrés) au moment de la poser
ALIAS = {f'poses/dos-{n}': (f'poses/debout-{n}', dict(tourne=180)) for n in ('casual-female', 'casual2-female', 'casual-male', 'casual2-male')}
# les tailles réelles de quelques bêtes, en mètres de haut : les cubes sont tous pareils
BETES = {'cow': 1.5, 'elephant': 2.8, 'giraffe': 4, 'lion': 1.2, 'tiger': 1.1, 'deer': 1.4, 'panda': 1.2, 'polar': 1.4, 'hog': .9, 'pig': .9,
         'beaver': .5, 'bee': .3, 'bunny': .4, 'cat': .45, 'caterpillar': .25, 'chick': .3, 'crab': .3, 'dog': .65, 'fish': .4, 'fox': .55,
         'koala': .6, 'monkey': .8, 'parrot': .4, 'penguin': .7}
LIEUX_BETES = {r'cow|pig|hog|chick|bunny|bee|caterpillar': ['champs'], r'cat|dog': ['village', 'interieur', 'champs'], r'fish|crab|penguin': ['rivage'],
               r'deer|fox|beaver': ['foret'], r'elephant|giraffe|lion|tiger|monkey|panda|koala|polar|parrot': ['reve']}
EXCLUS = r'knife|sword|gun|pistol|rifle|bomb|skull|grave|coffin|tomb|weapon|spike|trap|syringe|pill(?!ow)|trainset|hanukkah|kwanzaa|festivus'  # jamais montrés
# quelques mots en plus, là où le nom ne dit pas l’essentiel : une maison n’y est qu’un « bâtiment », une pomme qu’une « apple »
SYNONYMES = {
  r'city-kit-suburban/building': ['house', 'home'], r'city-kit-commercial/building-[a-n]$': ['shop', 'store'], r'skyscraper': ['tower', 'office'],
  r'holiday-kit/(tree-decorated|present|wreath|sock|candy-cane|gingerbread|nutcracker|lights|reindeer|snowman|sled)': ['christmas'],
  r'mini-market/(cash|shelf|shopping|freezer|bottle)': ['shop', 'supermarket'], r'display-bread': ['bakery'], r'display-fruit': ['fruit', 'market'],
  r'food-kit/(apple|pear|banana|cherries|grapes|lemon|orange|pineapple|strawberry|watermelon|melon|peach|plum|coconut|avocado)': ['fruit'],
  r'food-kit/(carrot|broccoli|cabbage|corn|eggplant|tomato|onion|pepper|potato|pumpkin|radish|beet|cauliflower|celery|leek|mushroom)': ['vegetable'],
  r'(tent|bedroll)': ['camping'], r'campfire': ['fire', 'camp'], r'(shower|bathtub|toilet|bathroom)': ['bathroom'],
  r'subway': ['metro'], r'tram': ['tramway'], r'boat-sail': ['sailing'], r'animal-bunny': ['rabbit'], r'animal-hog': ['boar'], r'animal-polar': ['bear'],
  r'character-female': ['woman'], r'character-male': ['man'], r'(books|bookcase)': ['library', 'reading'],
}
VIDES = set('a b c d e f g h i j k l m n o p q r s t u v w x y z alt alternative detailed detail type large small short tall long low high wide narrow half quarter corner inner outer round rounded square left right center end top bottom side open closed double single new old upgraded flat straight stage ground default simple plain classic modern basic'.split())

def mots(nom):
    s = re.sub(r'([a-z])([A-Z])', r'\1 \2', nom); s = re.sub(r'[-_]', ' ', s)
    out = []
    for m in s.lower().split():
        m = re.sub(r'\d+$', '', m)
        if len(m) < 2 or m in VIDES or m.isdigit(): continue
        out.append(m)
    return out

def trouve(motifs, nom):
    for motif, v in (motifs or {}).items():
        if re.search(motif, nom): return v
    return None

def textures(f): # les images qu’un modèle va chercher à côté de lui
    d = open(f, 'rb').read(); n = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + n])
    return [im['uri'] for im in j.get('images', []) if im.get('uri')]

def construire():
    objets, dest = [], os.path.join(RACINE, 'objets')
    for d in glob.glob(os.path.join(dest, '*/')): # les collections ; le LISEZMOI reste
        if SEULS is None or os.path.basename(os.path.normpath(d)) in SEULS: shutil.rmtree(d)
    for kit, K in KITS.items():
        if SEULS and kit not in SEULS: continue
        source = next((d for d in SOURCES if os.path.isdir(f'{d}/{kit}')), None)
        if not source: print('collection absente :', kit); continue
        fs = sorted(glob.glob(f'{source}/{kit}/**/*.glb', recursive=True))
        for f in fs:
            nom = os.path.basename(f)[:-4]
            if K.get('garder') and not re.search(K['garder'], nom): continue
            if re.search(EXCLUS, nom, re.I) or (K.get('exclus') and re.search(K['exclus'], nom)): continue
            if K.get('modules') and re.search(K['modules'], nom): continue
            m = mots(nom)
            if not m: continue
            for motif, plus in SYNONYMES.items():
                if re.search(motif, f'{kit}/{nom}'): m = m + [x for x in plus if x not in m]
            role = trouve(K.get('roles'), nom) or K['role']
            lieux = trouve(K.get('lieux_par'), nom) or K['lieux']
            lo, hi = boite(f); k = K['echelle']
            h = trouve(K.get('hauteurs'), nom)
            if h: k = h / max(hi[1] - lo[1], 1e-3) # sa hauteur réelle, donnée : l’échelle de la collection n’est pas la même partout
            if kit == 'cube-pets':
                bete = nom.replace('animal-', ''); k = BETES.get(bete, .6) / max(hi[1] - lo[1], 1e-3); lieux = trouve(LIEUX_BETES, bete) or lieux
            taille = [round((hi[i] - lo[i]) * k, 3) for i in range(3)]; base = round(lo[1] * k, 3)
            if 'tree' in nom or 'palm' in nom: role = 'decor' if role not in ('objet', 'ciel', 'eau') else role
            saison = trouve(K.get('saisons'), nom) or ('automne' if nom.endswith('_fall') else K.get('saison'))
            fichier = f'objets/{kit}/{nom}.glb'
            os.makedirs(os.path.join(dest, kit), exist_ok=True); shutil.copyfile(f, os.path.join(RACINE, fichier))
            for uri in textures(f): # sa palette, une seule fois pour la collection
                src, cible = os.path.join(os.path.dirname(f), uri), os.path.join(dest, kit, uri)
                if os.path.exists(src) and not os.path.exists(cible): os.makedirs(os.path.dirname(cible), exist_ok=True); shutil.copyfile(src, cible)
            o = dict(id=f'{kit}/{nom}', mots=m, role=role, lieux=lieux, taille=taille, base=base, fichier=fichier)
            if saison: o['saison'] = saison
            if K.get('enfoui') and base < -.05: o['sous'] = -base # le socle, sous terre
            if abs(k - 1) > 1e-6: o['echelle'] = round(k, 4)
            objets.append(o)
    return objets

if __name__ == '__main__':
    objets = construire()
    if SEULS: # les autres collections restent, dans leur ordre ; les rebâties prennent leur place, ou viennent à la fin
        avant = json.load(open(os.path.join(ICI, 'catalogue-brut.json'))); garde = [o for o in avant if o['id'].split('/')[0] not in SEULS]
        print(len(avant) - len(garde), 'objets remplacés dans', ', '.join(sorted(SEULS))); objets = garde + objets
    objets = [o for o in objets if o['id'] not in ALIAS]; parId = {o['id']: o for o in objets}
    for a, (source, plus) in ALIAS.items():
        if source in parId: objets.append({**parId[source], 'id': a, 'mots': mots(a.split('/')[1]), **plus})
    json.dump(objets, open(os.path.join(ICI, 'catalogue-brut.json'), 'w'), ensure_ascii=False)
    from collections import Counter
    print(len(objets), 'objets', dict(Counter(o['role'] for o in objets)))
    print(dict(Counter(l for o in objets for l in o['lieux'])))
    taille = sum(os.path.getsize(os.path.join(RACINE, o['fichier'])) for o in objets); print(f'{taille / 1048576:.1f} Mo')
