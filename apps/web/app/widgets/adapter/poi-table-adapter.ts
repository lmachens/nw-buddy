import { Injectable } from '@angular/core'
import { PoiDefinition } from '@nw-data/types'
import { GridOptions } from 'ag-grid-community'
import { defer, Observable, of } from 'rxjs'
import { TranslateService } from '~/i18n'
import { IconComponent, nwdbLinkUrl, NwService } from '~/nw'
import { AgGridComponent, SelectboxFilter } from '~/ui/ag-grid'
import { DataTableAdapter } from '~/ui/data-table'
import { humanize, shareReplayRefCount } from '~/utils'

@Injectable()
export class PoiTableAdapter extends DataTableAdapter<PoiDefinition> {
  public entityID(item: PoiDefinition): string | number {
    return item.TerritoryID
  }

  public entityCategory(item: PoiDefinition): string {
    return null
  }

  public options = defer(() =>
    of<GridOptions>({
      rowSelection: 'single',
      columnDefs: [
        this.colDef({
          colId: 'icon',
          headerValueGetter: () => 'Icon',
          resizable: false,
          sortable: false,
          filter: false,
          pinned: true,
          width: 54,
          cellRenderer: this.cellRenderer(({ data }) => {
            return this.createLinkWithIcon({
              target: '_blank',
              href: nwdbLinkUrl('zone', String(data.TerritoryID)),
              icon: data.MapIcon || data.CompassIcon || data.TooltipBackground,
              iconClass: ['scale-125', 'transition-all', 'translate-x-0', 'hover:translate-x-1'],
            })
          }),
        }),
        this.colDef({
          colId: 'name',
          headerValueGetter: () => 'Name',
          width: 250,
          valueGetter: this.valueGetter(({ data }) => this.i18n.get(data.NameLocalizationKey)),
          cellRenderer: this.cellRenderer(({ value }) => value?.replace(/\\n/g, '<br>')),
          cellClass: ['multiline-cell', 'py-2'],
          autoHeight: true,
          getQuickFilterText: ({ value }) => value,
        }),
        this.colDef({
          colId: 'description',
          headerValueGetter: () => 'Description',
          width: 250,
          valueGetter: this.valueGetter(({ data }) => this.i18n.get(`${data.NameLocalizationKey}_description`)),
          cellRenderer: this.cellRenderer(({ value }) => value?.replace(/\\n/g, '<br>')),
          cellClass: ['multiline-cell', 'py-2'],
          autoHeight: true,
          getQuickFilterText: ({ value }) => value,
        }),
        this.colDef({
          colId: 'groupSize',
          headerValueGetter: () => 'groupSize',
          field: this.fieldName('GroupSize'),
          hide: true,
        }),
        this.colDef({
          colId: 'lootTags',
          headerValueGetter: () => 'Loot Tags',
          field: this.fieldName('LootTags'),
          cellRenderer: this.cellRendererTags(humanize),
          filter: SelectboxFilter,
          filterParams: SelectboxFilter.params({
            showSearch: true,
            showCondition: true,
          }),
        }),
        this.colDef({
          colId: 'levelRange',
          headerValueGetter: () => 'Level Range',
          field: this.fieldName('LevelRange'),
          hide: false,
        }),
        this.colDef({
          colId: 'vitalsCategory',
          headerValueGetter: () => 'Vitals Category',
          field: this.fieldName('VitalsCategory'),
          hide: false,
        }),
      ],
    })
  )

  public entities: Observable<PoiDefinition[]> = defer(() => {
    return this.nw.db.pois
  }).pipe(shareReplayRefCount(1))

  public constructor(private nw: NwService, private i18n: TranslateService) {
    super()
  }
}