// 平台图标：GitHub 用 lucide 的 Github 图标；Gitee 暂用红色方块+文字，后续可替换为 SVG
import { h, defineComponent } from 'vue'
import { Github as GithubIcon } from 'lucide-vue-next'

export const Github = GithubIcon

export const Gitee = defineComponent({
  name: 'GiteeIcon',
  props: {
    size: { type: Number, default: 20 },
  },
  setup(props) {
    return () =>
      h(
        'span',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: `${props.size}px`,
            height: `${props.size}px`,
            borderRadius: '4px',
            background: '#c71d23',
            color: '#fff',
            fontSize: `${props.size * 0.55}px`,
            fontWeight: 700,
            lineHeight: 1,
          },
        },
        'G',
      )
  },
})
