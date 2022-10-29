import * as path from 'path'
import { program } from 'commander'
import { processArrayWithProgress, writeJSONFile } from './utils'
import { loadDatatables, splitToArrayRule } from './importer/loadDatatables'
import { importLocales } from './importer/importLocales'
import { importImages } from './importer/importImages'
import { generateTypes } from './importer/generateTypes'
import { checkExpressions } from './importer/checkExpressions'
import { NW_USE_PTR, webAppDir, extractDir, importDir, distDir } from '../env'

program
  .option('-i, --input <path>', 'input directory')
  .option('--ptr', 'PTR mode', NW_USE_PTR)
  .action(async () => {
    const options = program.opts<{ input: string; output: string; ptr: boolean }>()
    const input = options.input || extractDir(options.ptr)!
    const output = importDir(options.ptr)!
    const typesDir = path.join(webAppDir, 'nw-data')

    console.log('import from', input, 'to', output)

    console.log('loading datatables')
    const tables = await loadDatatables({
      inputDir: input,
      patterns: [
        '*_affixdefinitions',
        '*_affixstats',
        '*_afflictions',
        '*_areadefinitions',
        '*_categoricalprogression',
        '*_crafting',
        '*_craftingcategories',
        '*_damagetable_*',
        '*_damagetable',
        '*_damagetypes',
        '*_gameevents',
        '*_gamemodes',
        '*_gatherables',
        '*_housingitems',
        '*_housetypes',
        '*_itemdefinitions_consumables',
        '*_itemdefinitions_master_*',
        '*_itemdefinitions_resources',
        '*_itemdefinitions_weapons',
        '*_itemdefinitions_armor',
        '*_itemdefinitions_runes',
        '*_lootbuckets',
        '*_lootlimits',
        '*_loottables*',
        '*_manacosts_player',
        '*_metaachievements',
        '*_milestonerewards',
        '*_perkbuckets',
        '*_perks',
        '*_spelltable_*',
        '*_spelltable',
        '*_staminacosts_player',
        '*_statuseffectcategories',
        '*_statuseffects_*',
        '*_statuseffects',
        '*_territory_standing',
        '*_territorydefinitions',
        '*_territorygovernance',
        '*_tradeskill*',
        '*_umbralgsupgrades',
        '*_vitals',
        '*_vitalscategories',
        '*_vitalsleveldata',
        '*_vitalsmodifierdata',
        '*_weaponmastery',
        '*_xpamountsbylevel',
        'arenas/*',
        'gamemodemutators/*',
        'pointofinterestdefinitions/*',
        'weaponabilities/*',
      ].map((it) => it + '.json'),
      remap: [
        {
          file: /javelindata_gamemodes\.json/,
          rules: [
            splitToArrayRule({
              properties: ['PossibleItemDropIds', 'LootTags', 'MutLootTagsOverride'],
              separator: ',',
            }),
          ],
        },
        {
          file: /javelindata_vitals\.json/,
          rules: [
            splitToArrayRule({
              properties: ['VitalsCategories', 'LootTags'],
              separator: ',',
            }),
          ],
        },
        {
          file: /javelindata_territorydefinitions\.json/,
          rules: [
            splitToArrayRule({
              properties: ['LootTags'],
              separator: ',',
            }),
          ],
        },
        {
          file: /javelindata_mutationdifficulty\.json/,
          rules: [
            splitToArrayRule({
              properties: ['InjectedLootTags'],
              separator: ',',
            }),
          ],
        },
        {
          file: /javelindata_lootbuckets\.json/,
          rules: [
            splitToArrayRule({
              properties: /Tags\d+/,
              separator: ',',
            }),
          ],
        },
        {
          file: /_itemdefinitions_master_/,
          rules: [
            splitToArrayRule({
              properties: ['ItemClass'],
              separator: '+',
            }),
            splitToArrayRule({
              properties: ['IngredientCategories'],
              separator: ',',
            }),
          ],
        },
        {
          file: /javelindata_perks\.json/,
          rules: [
            splitToArrayRule({
              properties: ['ItemClass', 'ExclusiveLabels', 'ExcludeItemClass'],
              separator: '+',
            }),
            splitToArrayRule({
              properties: ['EquipAbility'],
              separator: ',',
            }),
          ],
        },
        {
          file: /javelindata_weaponabilities\.json/,
          rules: [
            splitToArrayRule({
              properties: ['AttackType'],
              separator: ',',
            }),
          ],
        },
        {
          file: /javelindata_statuseffects_.*\.json|javelindata_statuseffects\.json/,
          rules: [
            splitToArrayRule({
              properties: ['EffectCategories'],
              separator: '+',
            }),
          ],
        },
        {
          file: /pointofinterestdefinitions/,
          rules: [
            splitToArrayRule({
              properties: ['LootTags', 'VitalsCategory'],
              separator: ',',
            }),
          ],
        },
      ],
    })

    console.log('importing locales')
    await importLocales({
      input,
      output: path.join(output, 'localization'),
      tables,
      preserveKeys: [
        'ui_itemtypedescription_head_slot',
        'ui_itemtypedescription_chest_slot',
        'ui_itemtypedescription_hands_slot',
        'ui_itemtypedescription_legs_slot',
        'ui_itemtypedescription_feet_slot',
        'ui_weapon1',
        'ui_weapon2',
        'ui_ring_slot_tooltip',
        'ui_unlock_token_slot',
        'ui_amulet_slot_tooltip',
        'RarityLevel0_DisplayName',
        'RarityLevel1_DisplayName',
        'RarityLevel2_DisplayName',
        'RarityLevel3_DisplayName',
        'RarityLevel4_DisplayName',
        'ui_dungeon_mutator_bronze',
        'ui_dungeon_mutator_silver',
        'ui_dungeon_mutator_gold',
        'ui_strength',
        'ui_dexterity',
        'ui_intelligence',
        'ui_constitution',
        'ui_focus',
        'ui_resistance',
        'ui_bindOnEquip',
        'ui_bindOnPickup',
        'ui_durability',
        'ui_level_requirement',
        /^[a-zA-Z]+_DamageName/,
        /^ui_poi_.*_description/,
        /^ui_tooltip_.*/,
      ],
    }).then((files) => {
      checkExpressions({
        locales: files,
        output: './tmp/expressions.json',
      })
    })
    console.log('importing images')
    await importImages({
      input,
      output: output,
      tables,
      ignoreKeys: ['HiResIconPath'],
      rewrite: {
        ArmorAppearanceF: (key, value, obj) => `lyshineui/images/icons/items/${obj.ItemType}/${value}`,
        ArmorAppearanceM: (key, value, obj) => `lyshineui/images/icons/items/${obj.ItemType}/${value}`,
        WeaponAppearanceOverride: (key, value, obj) => `lyshineui/images/icons/items/${obj.ItemType}/${value}`,
      },
      rewritePath: (value) => {
        return path.relative(distDir, path.join(output, value)).replace(/\\/g, '/')
      },
    })
    console.log('writing datatables')
    await processArrayWithProgress(tables, async ({ relative, data }) => {
      const jsonPath = path.join(output, 'datatables', relative)
      await writeJSONFile(data, jsonPath, {
        createDir: true,
      })
    })

    console.log('generate types')
    await generateTypes(typesDir, tables)
  })
  .parse(process.argv)
