import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component } from '@angular/core'
import { ActivatedRoute, Router, RouterModule } from '@angular/router'
import { Damagetable, Vitals } from '@nw-data/types'
import { uniq } from 'lodash'
import { combineLatest, defer, map, Observable, of, shareReplay, switchMap, tap } from 'rxjs'
import { TranslateService } from '~/i18n'

import { NwDbService, NwModule } from '~/nw'
import { getVitalDungeon, getVitalFamilyInfo } from '~/nw/utils'
import { NW_MAX_CHARACTER_LEVEL } from '~/nw/utils/constants'
import { LayoutModule } from '~/ui/layout'
import { CaseInsensitiveMap, HtmlHeadService, observeQueryParam, observeRouteParam, shareReplayRefCount, tapDebug } from '~/utils'
import { LootModule } from '~/widgets/loot'
import { VitalsDetailModule } from '~/widgets/vitals-detail'

export type DetailTabId = 'loot-items' | 'loot-table' | 'damage-table'

@Component({
  standalone: true,
  templateUrl: './vital.component.html',
  styleUrls: ['./vital.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, NwModule, VitalsDetailModule, LootModule, LayoutModule],
  host: {
    class: 'flex-none flex flex-col',
  },
})
export class VitalComponent {
  protected vitalId$ = observeRouteParam(this.route, 'id')
  protected tabId$ = observeQueryParam(this.route, 'tab').pipe(
    map((it: DetailTabId): DetailTabId => it || 'loot-items')
  )

  protected vital$ = this.db.vital(this.vitalId$).pipe(tap((it) => this.onEntity(it))).pipe(shareReplayRefCount(1))

  protected loot$ = combineLatest({
    vital: this.vital$,
    dungeons: this.db.gameModes,
    difficulties: this.db.mutatorDifficulties,
    territories: this.db.territories,
  }).pipe(
    map(({ vital, dungeons, territories, difficulties }) => {
      const enemyLevel = vital.Level
      const dungeon = getVitalDungeon(vital, dungeons)
      const tags: string[] = [...(vital.LootTags || []), ...territories.map((it) => it.LootTags || []).flat(1)]
      if (dungeon) {
        tags.push(
          ...(dungeon.LootTags || []),
          ...(dungeon.MutLootTagsOverride || []),
          ...difficulties.map((it) => it.InjectedLootTags).flat(1)
        )
      }
      return {
        tags: uniq([
          'GlobalMod', // unknown purpose
          // 'MinContLevel',    // any zone
          // 'MinPOIContLevel', // any zone
          ...tags,
        ]),
        values: {
          MinContLevel: enemyLevel,
          MinPOIContLevel: enemyLevel,
          EnemyLevel: enemyLevel,
          Level: NW_MAX_CHARACTER_LEVEL,
        },
        tableId: vital.LootTableId
      }
    })
  )
  public lootTags$ = defer(() =>
    combineLatest({
      vital: this.vital$,
      dungeons: this.db.gameModes,
      difficulties: this.db.mutatorDifficulties,
      territories: this.db.territories,
    })
  ).pipe(
    map(({ vital, dungeons, difficulties, territories }) => {
      const dungeon = getVitalDungeon(vital, dungeons)
      const result: string[] = [...(vital.LootTags || []), ...territories.map((it) => it.LootTags || []).flat(1)]
      if (dungeon) {
        result.push(
          ...(dungeon.LootTags || []),
          ...(dungeon.MutLootTagsOverride || []),
          ...difficulties.map((it) => it.InjectedLootTags).flat(1)
        )
      }
      return uniq(result)
    })
  )

  public constructor(private route: ActivatedRoute, private router: Router, private db: NwDbService, private i18n: TranslateService, private head: HtmlHeadService) {
    //
  }

  public openTab(tab: DetailTabId) {
    this.router.navigate([], {
      queryParams: {
        tab: tab,
      },
      queryParamsHandling: 'merge',
      relativeTo: this.route,
    })
  }


  protected async onEntity(entity: Vitals) {
    if (!entity) {
      return
    }
    const info = getVitalFamilyInfo(entity)
    this.head.updateMetadata({
      title: [this.i18n.get(entity.DisplayName), 'Creature'].join(' - '),
      description: [
        this.i18n.get(info?.Name),
        `Level: ${entity.Level}`
      ].join(' - '),
      url: this.head.currentUrl,
      image: info?.Icon
    })
  }
}
