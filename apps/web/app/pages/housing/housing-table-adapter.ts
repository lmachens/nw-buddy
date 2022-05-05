import { Injectable } from '@angular/core'
import { Housingitems } from '@nw-data/types'
import { GridOptions } from 'ag-grid-community'
import { defer, map, Observable, shareReplay, tap } from 'rxjs'
import { IconComponent, NwService } from '~/core/nw'
import { CategoryFilter, mithrilCell } from '~/ui/ag-grid'
import { DataTableAdapter } from '~/ui/data-table'
import m from 'mithril'
import { ItemMarkerCell, ItemTrackerCell } from '~/widgets/item-tracker'

@Injectable()
export class HousingAdapterService extends DataTableAdapter<Housingitems> {
  public entityID(item: Housingitems): string {
    return item.HouseItemID
  }

  public entityCategory(item: Housingitems): string {
    return item.UIHousingCategory
  }

  public buildGridOptions(base: GridOptions): GridOptions {
    return this.nw.gridOptions({
      ...base,
      rowSelection: 'single',
      columnDefs: [
        {
          sortable: false,
          filter: false,
          width: 54,
          pinned: true,
          cellRenderer: this.mithrilCell({
            view: ({ attrs: { data } }) =>
              m('a', { target: '_blank', href: this.nw.nwdbUrl('item', data.HouseItemID) }, [
                m(IconComponent, {
                  src: this.nw.iconPath(data.IconPath),
                  class: `w-9 h-9 nw-icon bg-rarity-${this.nw.itemRarity(data)}`,
                }),
              ]),
          }),
        },
        {
          width: 300,
          headerName: 'Name',
          valueGetter: this.valueGetter(({ data }) => this.nw.translate(data.Name)),
          getQuickFilterText: ({ value }) => value,
        },
        {
          field: this.fieldName('HouseItemID'),
          hide: true,
        },
        {
          width: 100,
          headerName: 'Rarity',
          field: this.fieldName('ItemRarity'),
          filter: CategoryFilter,
        },
        {
          width: 80,
          field: this.fieldName('Tier'),
          filter: CategoryFilter,
          valueGetter: ({ data }) => this.nw.tierToRoman(data.Tier),
        },
        {
          headerName: 'User Data',
          children: [
            {
              width: 100,
              headerName: 'Bookmark',
              valueGetter: this.valueGetter(({ data }) => this.nw.itemPref.get(data.HouseItemID)?.mark || 0),
              cellRenderer: this.mithrilCell({
                view: ({ attrs: { data } }) => {
                  return m(ItemMarkerCell, {
                    itemId: data.HouseItemID,
                    meta: this.nw.itemPref,
                  })
                }
              })
            },
            {
              headerName: 'Stock',
              headerTooltip: 'Number of items currently owned',
              cellClass: 'text-right',
              cellRenderer: this.mithrilCell({
                view: ({ attrs: { data } }) => {
                  return m(ItemTrackerCell, {
                    class: 'text-right',
                    classEmpty: 'opacity-25',
                    itemId: data.HouseItemID,
                    meta: this.nw.itemPref,
                    mode: 'stock',
                  })
                },
              }),
              width: 90,
            },
            {
              headerName: 'Price',
              headerTooltip: 'Current price in Trading post',
              cellClass: 'text-right',
              cellRenderer: this.mithrilCell({
                view: ({ attrs: { data } }) => {
                  return m(ItemTrackerCell, {
                    class: 'text-right',
                    classEmpty: 'opacity-25',
                    itemId: data.HouseItemID,
                    meta: this.nw.itemPref,
                    mode: 'price',
                  })
                },
              }),
              width: 90,
            },
          ],
        },
        {
          headerName: 'Placement',
          field: this.fieldName('HousingTag1 Placed'),
          filter: CategoryFilter,
          width: 150,
        },
        {
          field: this.fieldName('UIHousingCategory'),
          filter: CategoryFilter,
          width: 150,
        },
        {
          headerName: 'Obtain',
          field: this.fieldName('HowToOptain (Primarily)'),
          filter: CategoryFilter,
          width: 150,
        },
        {
          width: 250,
          field: this.fieldName('HousingTags'),
          valueGetter: ({ data, colDef }) => {
            return (data[colDef.field] || '').trim().split('+')
          },
          cellRenderer: mithrilCell({
            view: ({ attrs: { value } }) => {
              return m(
                'div.flex.flex-row.flex-wrap.items-center.h-full',
                value.map((it: string) => {
                  return m('span.badge.badge-secondary.mr-1.badge-sm', it)
                })
              )
            },
          }),
          filter: CategoryFilter,
        },
      ],
    })
  }

  public entities: Observable<Housingitems[]> = defer(() => {
    return this.nw.db.housingItems.pipe(map((items) => items.filter((it) => !it.ExcludeFromGame)))
  }).pipe(
    shareReplay({
      refCount: true,
      bufferSize: 1,
    })
  )

  public constructor(private nw: NwService) {
    super()
  }
}