// ECharts 按需引入：注册本应用用到的图表、组件、渲染器。
// vue-echarts 的 <VChart> 会自动使用此处注册的内容。
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import {
  BarChart,
  LineChart,
  PieChart,
  HeatmapChart,
  ScatterChart,
  GraphChart,
} from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CalendarComponent,
  VisualMapComponent,
  DataZoomComponent,
  ToolboxComponent,
  GraphicComponent,
} from 'echarts/components'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  HeatmapChart,
  ScatterChart,
  GraphChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CalendarComponent,
  VisualMapComponent,
  DataZoomComponent,
  ToolboxComponent,
  GraphicComponent,
])

export { default as VChart } from 'vue-echarts'
