import { Injectable } from '@angular/core'
import { Vitals } from '@nw-data/types'
import { combineLatest, defer, map, Observable } from 'rxjs'
import { eqCaseInsensitive } from '~/utils'
import { NwDbService } from '../nw-db.service'
import { getVitalDungeon, getVitalDungeons, getVitalFamilyInfo, getVitalTypeMarker } from '../utils/vitals'

@Injectable({ providedIn: 'root' })
export class NwVitalsService {
  public all$ = defer(() => this.db.vitals)
  public byId$ = defer(() => this.db.vitalsMap)

  public iconStronattack = 'assets/icons/strongattack.png'
  public iconWeakattack = 'assets/icons/weakattack.png'

  public constructor(private db: NwDbService) {}

  public vitalMarkerIcon(vital: Vitals) {
    return getVitalTypeMarker(vital)
  }

  public vitalFamilyIcon(vital: Vitals) {
    return getVitalFamilyInfo(vital)?.Icon
  }

  public byExpedition(gameModeId: Observable<string>) {
    return combineLatest({
      vitals: this.all$,
      dungeons: this.db.gameModes,
      dungeonId: gameModeId,
    }).pipe(
      map(({ vitals, dungeons, dungeonId }) => {
        return vitals.filter((it) => getVitalDungeons(it, dungeons).some((dg) => eqCaseInsensitive(dg.GameModeId, dungeonId)))
      })
    )
  }
}
