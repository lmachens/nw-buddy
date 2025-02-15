import m from 'mithril'
import { svgEquals, svgNotEqual, svgTrashCan } from '~/ui/icons/svg'

export interface SelectFilterOption {
  id: string
  label: string
  icon?: string
  negate?: boolean
}

export interface SelectFilterStateAttrs {
  items: SelectFilterOption[]
  onClear: () => void
  onRemove: (id: string) => void
  onToggleComparator: (id: string) => void
}

export const SelectFilterState: m.Component<SelectFilterStateAttrs, any> = {
  view: ({ attrs: { items, onClear, onRemove, onToggleComparator } }) => {
    if (!items?.length) {
      return null
    }
    return [
      m(`ul.menu.menu-compact.rounded-md.flex-nowrap.flex-1`, [
        m.fragment(
          {},
          items.map((option) => {
            return m(OptionListItem, {
              item: option,
              onRemove,
              onToggleComparator,
            })
          })
        ),
      ]),
    ]
  },
}

const OptionListItem: m.Component<
  { item: SelectFilterOption } & Pick<SelectFilterStateAttrs, 'onToggleComparator' | 'onRemove'>
> = {
  view: ({ attrs: { item, onToggleComparator, onRemove } }) => {
    return m('li.input-group.input-group-sm.flex.flex-row', [
      m(
        'button.btn.btn-sm',
        {
          onclick: () => onToggleComparator(item.id),
        },
        m('i.aspect-square.w-4.h-4', [m.trust(item.negate ? svgNotEqual : svgEquals)])
      ),
      m('span.leading-none.py-0.flex-1.rounded-none', [item.icon && m('img.w-6.h-6', { src: item.icon }), item.label || '-- empty --']),
      m(
        'button.btn.btn-sm',
        {
          onclick: () => onRemove(item.id),
        },
        m('i.w-4.h-4.flex.items-center', m.trust(svgTrashCan))
      ),
    ])
  },
}
