import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Table, Download, List } from 'lucide-react';

interface DataChartProps {
  data: any[];
  config: {
    type: string;
    x_axis: string;
    y_axis: string;
  };
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

const tooltipStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  color: 'var(--foreground)',
};

/** Bucket numeric values into `binCount` equal-width bins for a histogram. */
function buildHistogram(values: number[], binCount: number): { bin: string; count: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ bin: String(min), count: values.length }];
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    bin: (min + i * width).toFixed(1),
    count: 0,
  }));
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count += 1;
  }
  return bins;
}

const normalizeType = (t?: string): string =>
  t && t.toLowerCase() !== 'none' ? t.toLowerCase() : 'table';

const DataChart: React.FC<DataChartProps> = ({ data, config }) => {
  // Initialise from the config so a real chart renders immediately (no table flash).
  const [activeType, setActiveType] = useState<string>(() => normalizeType(config?.type));
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // Export the rendered chart SVG as a PNG without a dependency: resolve CSS
  // variable colors (they don't survive standalone serialization) to concrete
  // values, draw the SVG onto a canvas, then download.
  const downloadPNG = () => {
    const svg = chartRef.current?.querySelector('svg');
    if (!svg) return;
    const rootStyle = getComputedStyle(document.documentElement);
    let svgStr = new XMLSerializer().serializeToString(svg);
    svgStr = svgStr.replace(/var\((--[a-z0-9-]+)\)/gi, (_m, name) => rootStyle.getPropertyValue(name).trim() || '#888888');
    if (!svgStr.includes('xmlns=')) {
      svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const rect = svg.getBoundingClientRect();
    const width = rect.width || 600;
    const height = rect.height || 260;
    const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.fillStyle = rootStyle.getPropertyValue('--card').trim() || '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'chart.png';
          a.click();
          URL.revokeObjectURL(a.href);
        }, 'image/png');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  useEffect(() => {
    setActiveType(normalizeType(config?.type));
  }, [config]);

  if (!data || data.length === 0) {
    return null;
  }

  const keys = Object.keys(data[0]);
  const xAxisKey = config.x_axis || keys.find(k => typeof data[0][k] === 'string' || k.toLowerCase().includes('name') || k.toLowerCase().includes('date') || k.toLowerCase().includes('id')) || keys[0] || '';
  const yAxisKey = config.y_axis || keys.find(k => typeof data[0][k] === 'number' || k.toLowerCase().includes('amount') || k.toLowerCase().includes('price') || k.toLowerCase().includes('qty') || k.toLowerCase().includes('count')) || keys.find(k => !isNaN(Number(data[0][k]))) || keys[1] || '';

  const formattedData = data.map((row) => ({
    ...row,
    [yAxisKey]: Number(row[yAxisKey]) || 0,
  }));

  const renderTable = () => {
    return (
      <div className="max-h-[260px] overflow-auto rounded-lg border border-border bg-background/40 custom-scrollbar">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 backdrop-blur-md">
              {keys.map((h) => (
                <th key={h} className="p-2.5 font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-muted/10 transition-colors">
                {keys.map((h) => (
                  <td key={h} className="p-2.5 font-medium text-foreground/80">{String(row[h])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderChart = () => {
    switch (activeType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey={xAxisKey} stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--primary)' }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              {showLegend && <Legend wrapperStyle={{ color: 'var(--muted-foreground)', fontSize: '11px' }} />}
              <Bar dataKey={yAxisKey} fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey={xAxisKey} stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              {showLegend && <Legend wrapperStyle={{ color: 'var(--muted-foreground)', fontSize: '11px' }} />}
              <Line type="monotone" dataKey={yAxisKey} stroke="var(--chart-2)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--chart-2)' }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ color: 'var(--muted-foreground)', fontSize: '11px' }} />
              <Pie data={formattedData} dataKey={yAxisKey} nameKey={xAxisKey} cx="50%" cy="47%" innerRadius={50} outerRadius={80} paddingAngle={4}>
                {formattedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="var(--card)" strokeWidth={2} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey={xAxisKey} name={xAxisKey} stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
              <YAxis dataKey={yAxisKey} name={yAxisKey} stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={formattedData} fill="var(--chart-4)" />
            </ScatterChart>
          </ResponsiveContainer>
        );
      case 'histogram': {
        const values = data.map((r) => Number(r[yAxisKey])).filter((n) => !isNaN(n));
        const bins = buildHistogram(values, 10);
        return (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bins} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="bin" stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      }
      case 'kpi': {
        const nums = data.map((r) => Number(r[yAxisKey])).filter((n) => !isNaN(n));
        const value = nums.length === 1 ? nums[0] : nums.reduce((a, b) => a + b, 0);
        const label = nums.length === 1 ? yAxisKey : `Total ${yAxisKey}`;
        return (
          <div className="flex h-[260px] flex-col items-center justify-center">
            <span className="font-display text-5xl font-bold text-foreground">
              {Number.isFinite(value) ? value.toLocaleString() : '—'}
            </span>
            <span className="mt-2 text-sm text-muted-foreground">{label}</span>
          </div>
        );
      }
      case 'table':
      default:
        // 'map' and any unsupported type degrade to the raw table.
        return renderTable();
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card/40 p-4 shadow-sm backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-violet-text" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Visualization</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background/50 p-0.5">
          <button
            onClick={() => setActiveType('bar')}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${activeType === 'bar' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            title="Bar Chart"
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setActiveType('line')}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${activeType === 'line' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            title="Line Chart"
          >
            <LineChartIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setActiveType('pie')}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${activeType === 'pie' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            title="Pie Chart"
          >
            <PieChartIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setActiveType('table')}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${activeType === 'table' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            title="Raw Table"
          >
            <Table className="h-3.5 w-3.5" />
          </button>
          {(activeType === 'bar' || activeType === 'line') && (
            <button
              onClick={() => setShowLegend((s) => !s)}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${showLegend ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title={showLegend ? 'Hide legend' : 'Show legend'}
              aria-pressed={showLegend}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          )}
          {activeType !== 'table' && (
            <button
              onClick={downloadPNG}
              className="rounded px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-all hover:text-foreground"
              title="Download chart as PNG"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div ref={chartRef}>{renderChart()}</div>
    </div>
  );
};

export default DataChart;
