import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Grade } from '../types';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Activity, Award, HelpCircle, Calendar, Filter, Sparkles, AlertCircle } from 'lucide-react';

interface StudentAverageTrendD3Props {
  grades: Grade[];
  classAverage?: number;
  language?: string;
}

export interface AveragePoint {
  id: string;
  date: Date;
  dateStr: string;
  examName: string;
  subject: string;
  score20: number;
  cumulativeAvg: number;
  evalCount: number;
}

export interface MonthlyAveragePoint {
  monthKey: string; // e.g. "2023-09"
  label: string;    // e.g. "Sept 2023"
  date: Date;
  avgScore20: number;
  evalCount: number;
  cumulativeAvg: number;
}

export default function StudentAverageTrendD3({
  grades = [],
  classAverage,
  language = 'fr'
}: StudentAverageTrendD3Props) {
  const isFr = language === 'fr';

  // Mode: 'cumulative' (Évolution au fil des évaluations) or 'monthly' (Moyenne mensuelle)
  const [viewMode, setViewMode] = useState<'cumulative' | 'monthly'>('cumulative');
  const [showPassingLine, setShowPassingLine] = useState<boolean>(true);
  const [showClassAvg, setShowClassAvg] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<AveragePoint | MonthlyAveragePoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 650, height: 320 });

  // Handle ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setDimensions({
            width: Math.max(entry.contentRect.width, 320),
            height: 320
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 1. Process Cumulative Evaluation Data
  const cumulativeData = useMemo<AveragePoint[]>(() => {
    if (!grades || grades.length === 0) return [];

    // Sort chronologically
    const sorted = [...grades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningSum = 0;
    return sorted.map((g, index) => {
      const score20 = (g.score / g.maxScore) * 20;
      runningSum += score20;
      const count = index + 1;
      const cumulativeAvg = Number((runningSum / count).toFixed(2));
      const parsedDate = new Date(g.date);

      return {
        id: g.id || `grade-${index}`,
        date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
        dateStr: g.date ? new Date(g.date).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }) : `Éval ${count}`,
        examName: g.examName || (isFr ? `Évaluation ${count}` : `Exam ${count}`),
        subject: g.subject || (isFr ? 'Général' : 'General'),
        score20: Number(score20.toFixed(1)),
        cumulativeAvg,
        evalCount: count
      };
    });
  }, [grades, isFr]);

  // 2. Process Monthly Data
  const monthlyData = useMemo<MonthlyAveragePoint[]>(() => {
    if (!grades || grades.length === 0) return [];

    const sorted = [...grades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const groups = new Map<string, { total: number; count: number; date: Date }>();

    sorted.forEach((g) => {
      const d = new Date(g.date);
      if (isNaN(d.getTime())) return;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;

      const score20 = (g.score / g.maxScore) * 20;
      const existing = groups.get(monthKey) || { total: 0, count: 0, date: new Date(year, d.getMonth(), 15) };
      groups.set(monthKey, {
        total: existing.total + score20,
        count: existing.count + 1,
        date: existing.date
      });
    });

    let runningSum = 0;
    let runningCount = 0;

    return Array.from(groups.entries()).map(([monthKey, data]) => {
      runningSum += data.total;
      runningCount += data.count;
      const monthlyAvg = Number((data.total / data.count).toFixed(2));
      const cumulativeAvg = Number((runningSum / runningCount).toFixed(2));

      const monthName = data.date.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' });

      return {
        monthKey,
        label: monthName,
        date: data.date,
        avgScore20: monthlyAvg,
        evalCount: data.count,
        cumulativeAvg
      };
    });
  }, [grades, isFr]);

  // 3. Stats Summary
  const currentAvg = cumulativeData.length > 0 ? cumulativeData[cumulativeData.length - 1].cumulativeAvg : 0;
  const initialAvg = cumulativeData.length > 0 ? cumulativeData[0].cumulativeAvg : 0;
  const avgDelta = Number((currentAvg - initialAvg).toFixed(2));
  const maxAvgReached = cumulativeData.length > 0 ? Math.max(...cumulativeData.map(d => d.cumulativeAvg)) : 0;
  const minAvgReached = cumulativeData.length > 0 ? Math.min(...cumulativeData.map(d => d.cumulativeAvg)) : 0;

  // 4. Render D3 Chart
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous renders

    const { width, height } = dimensions;
    const margin = { top: 25, right: 30, bottom: 45, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const dataset = viewMode === 'cumulative' ? cumulativeData : monthlyData;

    if (dataset.length === 0) return;

    // --- SCALES ---
    // X Scale
    let xScale: d3.ScaleTime<number, number> | d3.ScalePoint<string>;

    if (viewMode === 'cumulative') {
      // Use time scale if multiple distinct dates exist, or point scale
      const timeExtent = d3.extent(cumulativeData, (d: AveragePoint) => d.date) as [Date, Date];
      if (timeExtent[0] && timeExtent[1] && timeExtent[0].getTime() !== timeExtent[1].getTime()) {
        xScale = d3.scaleTime()
          .domain(timeExtent)
          .range([0, innerWidth]);
      } else {
        xScale = d3.scalePoint<string>()
          .domain(cumulativeData.map((d, i) => `${i}-${d.dateStr}`))
          .range([0, innerWidth])
          .padding(0.5);
      }
    } else {
      xScale = d3.scalePoint<string>()
        .domain(monthlyData.map(d => d.label))
        .range([0, innerWidth])
        .padding(0.4);
    }

    // Y Scale: Fixed 0 to 20 range for academic scale
    const yScale = d3.scaleLinear()
      .domain([0, 20])
      .range([innerHeight, 0]);

    // --- GRID LINES ---
    const yTicks = [0, 5, 10, 12, 14, 16, 20];
    
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', d => d === 10 ? '#f59e0b' : '#e2e8f0')
      .attr('stroke-dasharray', d => d === 10 ? '4 4' : '2 2')
      .attr('stroke-width', d => d === 10 ? 1.5 : 1)
      .attr('opacity', d => d === 10 ? 0.8 : 0.5);

    // --- PASSING THRESHOLD LINE (10/20) ---
    if (showPassingLine) {
      const y10 = yScale(10);
      g.append('rect')
        .attr('x', innerWidth - 75)
        .attr('y', y10 - 10)
        .attr('width', 70)
        .attr('height', 18)
        .attr('rx', 9)
        .attr('fill', '#fef3c7')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 1);

      g.append('text')
        .attr('x', innerWidth - 40)
        .attr('y', y10 + 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .attr('fill', '#b45309')
        .text(isFr ? 'Seuil 10/20' : 'Pass 10/20');
    }

    // --- CLASS AVERAGE BENCHMARK LINE ---
    if (showClassAvg && typeof classAverage === 'number' && classAverage > 0) {
      const yClass = yScale(classAverage);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yClass)
        .attr('y2', yClass)
        .attr('stroke', '#6366f1')
        .attr('stroke-dasharray', '5 3')
        .attr('stroke-width', 1.5);

      g.append('rect')
        .attr('x', 5)
        .attr('y', yClass - 11)
        .attr('width', 110)
        .attr('height', 18)
        .attr('rx', 9)
        .attr('fill', '#e0e7ff')
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 1);

      g.append('text')
        .attr('x', 60)
        .attr('y', yClass + 1)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .attr('fill', '#4338ca')
        .text(`${isFr ? 'Moy. Classe:' : 'Class Avg:'} ${classAverage.toFixed(1)}`);
    }

    // --- GRADIENT DEFINITION ---
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'avg-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#6366f1')
      .attr('stop-opacity', 0.25);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#6366f1')
      .attr('stop-opacity', 0.0);

    // Helper to get X position
    const getX = (d: any, i: number) => {
      if (viewMode === 'cumulative') {
        if ('getTime' in xScale) {
          return (xScale as d3.ScaleTime<number, number>)(d.date);
        } else {
          return (xScale as d3.ScalePoint<string>)(`${i}-${d.dateStr}`) || 0;
        }
      } else {
        return (xScale as d3.ScalePoint<string>)(d.label) || 0;
      }
    };

    const getY = (d: any) => yScale(d.cumulativeAvg);

    // --- AREA FILL ---
    const areaGenerator = d3.area<any>()
      .x((d, i) => getX(d, i))
      .y0(innerHeight)
      .y1(d => getY(d))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(dataset)
      .attr('fill', 'url(#avg-gradient)')
      .attr('d', areaGenerator);

    // --- MAIN TREND LINE ---
    const lineGenerator = d3.line<any>()
      .x((d, i) => getX(d, i))
      .y(d => getY(d))
      .curve(d3.curveMonotoneX);

    const path = g.append('path')
      .datum(dataset)
      .attr('fill', 'none')
      .attr('stroke', '#4f46e5')
      .attr('stroke-width', 3.5)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('d', lineGenerator);

    // Animate Line Drawing
    const totalLength = path.node()?.getTotalLength() || 0;
    if (totalLength > 0) {
      path
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(900)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);
    }

    // --- DATA POINTS (CIRCLES) ---
    const pointsGroup = g.append('g').attr('class', 'data-points');

    dataset.forEach((d, i) => {
      const cx = getX(d, i);
      const cy = getY(d);

      // Outer halo for high contrast
      pointsGroup.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 7)
        .attr('fill', '#ffffff')
        .attr('stroke', '#4f46e5')
        .attr('stroke-width', 2.5)
        .attr('class', 'transition-all duration-200 cursor-pointer');

      // Inner color node based on score
      const nodeColor = d.cumulativeAvg >= 14 ? '#10b981' : d.cumulativeAvg >= 10 ? '#3b82f6' : '#ef4444';

      pointsGroup.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 3.5)
        .attr('fill', nodeColor)
        .attr('class', 'pointer-events-none');

      // Invisible hit area for tooltip
      pointsGroup.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 18)
        .attr('fill', 'transparent')
        .attr('class', 'cursor-pointer')
        .on('mouseenter', (event) => {
          setHoveredPoint(d);
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltipPos({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top
            });
          }
        })
        .on('mousemove', (event) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltipPos({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top
            });
          }
        })
        .on('mouseleave', () => {
          setHoveredPoint(null);
          setTooltipPos(null);
        });
    });

    // --- AXES ---
    // X Axis
    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .attr('class', 'x-axis');

    if (viewMode === 'cumulative') {
      if ('getTime' in xScale) {
        xAxisG.call(
          d3.axisBottom(xScale as d3.ScaleTime<number, number>)
            .ticks(Math.min(dataset.length, 6))
            .tickFormat((d) => d3.timeFormat('%d %b')(d as Date))
        );
      } else {
        xAxisG.call(d3.axisBottom(xScale as d3.ScalePoint<string>));
      }
    } else {
      xAxisG.call(d3.axisBottom(xScale as d3.ScalePoint<string>));
    }

    xAxisG.selectAll('text')
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .attr('fill', '#64748b');

    xAxisG.selectAll('line').attr('stroke', '#cbd5e1');
    xAxisG.select('.domain').attr('stroke', '#cbd5e1');

    // Y Axis
    const yAxisG = g.append('g')
      .attr('class', 'y-axis')
      .call(
        d3.axisLeft(yScale)
          .tickValues([0, 5, 10, 12, 14, 16, 20])
          .tickFormat(d => `${d}/20`)
      );

    yAxisG.selectAll('text')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('fill', '#475569');

    yAxisG.selectAll('line').attr('stroke', '#e2e8f0');
    yAxisG.select('.domain').attr('stroke', '#cbd5e1');

  }, [cumulativeData, monthlyData, dimensions, viewMode, showPassingLine, showClassAvg, classAverage, isFr]);

  if (!grades || grades.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500">
        <AlertCircle className="h-8 w-8 mx-auto text-slate-400 mb-2" />
        <p className="text-xs font-semibold">
          {isFr ? "Aucune évaluation enregistrée pour calculer l'évolution de la moyenne." : "No grades recorded to display average evolution."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Current Cumulative Average */}
        <div className="p-3.5 bg-gradient-to-br from-indigo-50/80 to-white rounded-xl border border-indigo-100 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
              {isFr ? 'Moyenne Actuelle' : 'Current Average'}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-indigo-950">{currentAvg.toFixed(2)}</span>
              <span className="text-xs text-indigo-400 font-bold">/ 20</span>
            </div>
          </div>
          <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-2xs">
            <Award className="h-4 w-4" />
          </div>
        </div>

        {/* Annual Progression Delta */}
        <div className="p-3.5 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              {isFr ? 'Progression Globale' : 'Annual Delta'}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`text-xl font-black ${avgDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {avgDelta >= 0 ? `+${avgDelta}` : avgDelta}
              </span>
              <span className="text-[10px] font-bold text-slate-400">pts</span>
            </div>
          </div>
          <div className={`p-2 rounded-lg text-white shadow-2xs ${avgDelta >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
            {avgDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          </div>
        </div>

        {/* Highest Average Level */}
        <div className="p-3.5 bg-gradient-to-br from-emerald-50/60 to-white rounded-xl border border-emerald-100 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              {isFr ? 'Pic Maximum' : 'Peak Average'}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-emerald-950">{maxAvgReached.toFixed(2)}</span>
              <span className="text-xs text-emerald-400 font-bold">/ 20</span>
            </div>
          </div>
          <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-2xs">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>

        {/* Evaluations count */}
        <div className="p-3.5 bg-gradient-to-br from-amber-50/60 to-white rounded-xl border border-amber-100 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
              {isFr ? 'Évaluations Cumulées' : 'Total Evaluations'}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-amber-950">{cumulativeData.length}</span>
              <span className="text-xs text-amber-500 font-semibold">{isFr ? 'notes' : 'grades'}</span>
            </div>
          </div>
          <div className="p-2 bg-amber-500 text-white rounded-lg shadow-2xs">
            <Calendar className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Chart Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
          <button
            onClick={() => setViewMode('cumulative')}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'cumulative'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {isFr ? 'Par Évaluation' : 'By Evaluation'}
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'monthly'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {isFr ? 'Par Mois' : 'Monthly'}
          </button>
        </div>

        {/* Toggle options */}
        <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPassingLine}
              onChange={(e) => setShowPassingLine(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
            />
            <span>{isFr ? 'Ligne de passage (10/20)' : 'Passing line (10/20)'}</span>
          </label>

          {typeof classAverage === 'number' && classAverage > 0 && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showClassAvg}
                onChange={(e) => setShowClassAvg(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
              />
              <span>{isFr ? 'Moyenne de classe' : 'Class average'}</span>
            </label>
          )}
        </div>
      </div>

      {/* D3 Canvas Wrapper */}
      <div ref={containerRef} className="relative w-full bg-white p-2 rounded-xl border border-slate-100 shadow-2xs overflow-hidden">
        <svg ref={svgRef} className="w-full h-[320px] select-none" />

        {/* Tooltip Popup */}
        {hoveredPoint && tooltipPos && (
          <div
            className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 bg-slate-900/95 text-white p-3 rounded-xl shadow-xl text-xs backdrop-blur-md border border-slate-700 min-w-[160px]"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5 mb-2">
              <span className="font-bold text-indigo-300">
                {'examName' in hoveredPoint ? hoveredPoint.examName : hoveredPoint.label}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {'dateStr' in hoveredPoint ? hoveredPoint.dateStr : hoveredPoint.monthKey}
              </span>
            </div>

            {'subject' in hoveredPoint && (
              <div className="flex justify-between text-slate-300 text-[11px] mb-1">
                <span>{isFr ? 'Matière :' : 'Subject:'}</span>
                <span className="font-semibold text-white">{hoveredPoint.subject}</span>
              </div>
            )}

            {'score20' in hoveredPoint && (
              <div className="flex justify-between text-slate-300 text-[11px] mb-1">
                <span>{isFr ? 'Note de l\'éval :' : 'Grade:'}</span>
                <span className="font-bold text-amber-400">{hoveredPoint.score20} / 20</span>
              </div>
            )}

            {'avgScore20' in hoveredPoint && (
              <div className="flex justify-between text-slate-300 text-[11px] mb-1">
                <span>{isFr ? 'Moyenne du mois :' : 'Monthly Avg:'}</span>
                <span className="font-bold text-amber-400">{hoveredPoint.avgScore20} / 20</span>
              </div>
            )}

            <div className="flex justify-between text-slate-200 text-[11px] pt-1.5 border-t border-slate-800 font-semibold">
              <span>{isFr ? 'Moyenne Générale :' : 'Overall Avg:'}</span>
              <span className="text-emerald-400 font-extrabold text-xs">{hoveredPoint.cumulativeAvg} / 20</span>
            </div>
          </div>
        )}
      </div>

      {/* Explanatory footer note */}
      <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-start gap-2 text-xs text-indigo-900">
        <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {isFr
            ? "Ce graphique interactif D3.js calcule en temps réel la moyenne générale cumulée de l'élève à chaque nouvelle évaluation. Il permet de suivre visuellement si la trajectoire globale est ascendante ou descendante par rapport au seuil de réussite (10/20) et à la moyenne de la classe."
            : "This interactive D3.js chart computes the student's cumulative overall average after every evaluation. It visually highlights whether the academic trajectory is trending upwards or downwards relative to the passing threshold (10/20) and class benchmark."}
        </p>
      </div>
    </div>
  );
}
