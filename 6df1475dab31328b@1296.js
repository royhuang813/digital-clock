// https://observablehq.com/d/6df1475dab31328b@1296
export default function define(runtime, observer) {
  const main = runtime.module();
  main.variable(observer("digitalClock")).define("digitalClock", ["svg", "run", "invalidation", "updateSvg", "Promises"], async function*(svg, run, invalidation, updateSvg, Promises) {
    const svgNode = svg`<svg/>`;
    yield svgNode;

    const framesPerSecond = 60;
    for (const grid of run(invalidation)) {
      updateSvg(svgNode, grid);
      await Promises.tick(1000 / framesPerSecond);
    }
  });
  main.variable(observer("addClock")).define("addClock", ["settings"], function(settings) {
    return function addClock(cell) {
      const clock = cell.append("g").style("transform", `translate(${settings.radius}px, ${settings.radius}px)`);

      const circleStrokeWidth = settings.radius / 12;
      const handStrokeWidth = settings.radius / 6;
      clock
        .append("circle")
        .attr("r", settings.radius - circleStrokeWidth / 2)
        .attr("fill", "none")
        .attr("stroke", "#eee")
        .attr("stroke-width", circleStrokeWidth);

      clock
        .append("line")
        .attr("class", "hour-hand")
        .attr("y2", -4 * handStrokeWidth)
        .attr("stroke", "#333")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", handStrokeWidth);

      clock
        .append("line")
        .attr("class", "minute-hand")
        .attr("y2", -5 * handStrokeWidth)
        .attr("stroke", "#333")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", handStrokeWidth);
    };
  });
  main.variable(observer("updateClock")).define("updateClock", function() {
    return function updateClock(cell) {
      cell.select(".hour-hand").style("transform", hours => `rotate(${(hours / 12) * 360}deg`);

      cell.select(".minute-hand").style("transform", hours => {
        const minutes = (hours - Math.floor(hours)) * 60;
        return `rotate(${(minutes / 60) * 360}deg`;
      });
    };
  });
  main.variable(observer("updateSvg")).define("updateSvg", ["settings", "d3", "addClock", "updateClock"], function(settings, d3, addClock, updateClock) {
    return function updateSvg(svgNode, grid) {
      const width = 2 * settings.radius * grid[0].length;
      const height = 2 * settings.radius * grid.length;

      const rows = d3
        .select(svgNode)
        .attr("viewBox", `0, 0, ${width}, ${height}`)
        .selectAll(".row")
        .data(grid)
        .join(enter =>
          enter
            .append("g")
            .attr("class", "row")
            .style("transform", (d, row) => `translate(0px, ${2 * settings.radius * row}px)`)
        );

      rows
        .selectAll(".column")
        .data(d => d)
        .join(enter =>
          enter
            .append("g")
            .attr("class", "column")
            .style("transform", (d, column) => `translate(${2 * settings.radius * column}px, 0px)`)
            .call(addClock)
        )
        .call(updateClock);
    };
  });
  main.variable(observer("run")).define("run", ["settings", "isGeneratingThumbnail", "gridForTime"], function(settings, isGeneratingThumbnail, gridForTime) {
    return function* run(stopPromise) {
      const startTime = new Date().getTime();

      let running = true;
      stopPromise.then(() => (running = false));

      while (running) {
        const elapsed = settings.speedup * (new Date() - startTime);
        const date = new Date(startTime + elapsed);
        if (isGeneratingThumbnail) {
          yield gridForTime(settings.previewDate, 5000);
        } else {
          yield gridForTime(date, elapsed);
        }
      }
    };
  });
  main.variable(observer("gridForTime")).define("gridForTime", ["ticks", "clamp", "makeGrid", "drawGrid", "separatorGrid", "digits", "interpolateGrid", "spriteGrids", "settings"], function(ticks, clamp, makeGrid, drawGrid, separatorGrid, digits, interpolateGrid, spriteGrids, settings) {
    return function gridForTime(date, elapsed) {
      const seconds = (date % (60 * 1000)) / 1000;
      const transitionStart = ticks.length;
      const transitionSeconds = 60 - transitionStart;
      const normalizedTime = clamp((seconds - transitionStart) / transitionSeconds);

      const timeGrid = makeGrid();
      drawGrid(timeGrid, separatorGrid, [2, 9]);
      digits.forEach(({ fromDate, column }) => {
        const from = fromDate(date);
        const to = fromDate(new Date(date.getTime() + 60 * 1000));
        const digitGrid = interpolateGrid(spriteGrids[from], spriteGrids[to], normalizedTime);
        drawGrid(timeGrid, digitGrid, [1, column]);
      });

      ticks.forEach(([row, column], delay) => {
        let minutes = date.getMinutes() + delay / 60;
        if (delay >= date.getSeconds()) {
          minutes -= 1;
        }
        timeGrid[row][column] = date.getHours() + minutes / 60;
      });

      const fade = 1000 * settings.fadeSeconds;
      if (Math.abs(elapsed) < fade) {
        if (elapsed > 0) {
          // Fade in
          return interpolateGrid(makeGrid(), timeGrid, elapsed / fade);
        } else {
          // Fade out
          return interpolateGrid(timeGrid, makeGrid(), 1 + elapsed / fade);
        }
      } else {
        return timeGrid;
      }
    };
  });
  main.variable(observer("makeGrid")).define("makeGrid", function() {
    return function makeGrid() {
      return Array.from({ length: 8 }, () => Array.from({ length: 20 }, () => 0));
    };
  });
  main.variable(observer("drawGrid")).define("drawGrid", function() {
    return function drawGrid(target, source, [row, column]) {
      source.forEach((sourceRow, i) => {
        sourceRow.forEach((cell, j) => {
          target[row + i][column + j] = cell;
        });
      });
    };
  });
  main.variable(observer("digits")).define("digits", function() {
    return [
      {
        fromDate: date => Math.floor(date.getHours() / 10),
        column: 1
      },
      {
        fromDate: date => date.getHours() % 10,
        column: 5
      },
      {
        fromDate: date => Math.floor(date.getMinutes() / 10),
        column: 11
      },
      {
        fromDate: date => date.getMinutes() % 10,
        column: 15
      }
    ];
  });
  main.variable(observer("interpolateGrid")).define("interpolateGrid", ["interpolateHours"], function(interpolateHours) {
    return function interpolateGrid(from, to, normalizedTime) {
      return from.map((row, i) => row.map((cell, j) => interpolateHours(cell, to[i][j], normalizedTime)));
    };
  });
  main.variable(observer("interpolateHours")).define("interpolateHours", ["clamp", "d3"], function(clamp, d3) {
    return function interpolateHours(from, to, normalizedTime) {
      from %= 12;
      to %= 12;
      if (from < to) {
        if (to - from > 6) {
          from += 12;
        }
      } else {
        if (from - to > 6) {
          to += 12;
        }
      }
      if (to === from) {
        return from;
      }
      const speedup = Math.sqrt(6 / Math.abs(to - from));
      const delay = speedup - 1;
      normalizedTime = clamp(normalizedTime * speedup - delay);
      return from + d3.easeCubic(normalizedTime) * (to - from);
    };
  });
  main.variable(observer("hoursByOrientation")).define("hoursByOrientation", function() {
    return {
      empty: 0,
      horizontal: 9.25,
      vertical: 6,
      "top-left": 6.25,
      "top-right": 5.75,
      "bottom-left": 3,
      "bottom-right": 9
    };
  });
  main.variable(observer("spriteStrings")).define("spriteStrings", function() {
    return [
      `111
     101
     101
     101
     111`,
      `001
     001
     001
     001
     001`,
      `111
     001
     111
     100
     111`,
      `111
     001
     111
     001
     111`,
      `101
     101
     111
     001
     001`,
      `111
     100
     111
     001
     111`,
      `111
     100
     111
     101
     111`,
      `111
     001
     001
     001
     001`,
      `111
     101
     111
     101
     111`,
      `111
     101
     111
     001
     111`,
      `1
     0
     1`
    ];
  });
  main.variable(observer("spritePixels")).define("spritePixels", ["spriteStrings"], function(spriteStrings) {
    return spriteStrings.map(spriteString => spriteString.split("\n").map(row => [...row.trim()].map(pixel => +pixel)));
  });
  main.variable(observer("spriteGrids")).define("spriteGrids", ["spritePixels", "pixelsToHours"], function(spritePixels, pixelsToHours) {
    return spritePixels.map(pixelsToHours);
  });
  main.variable(observer("separatorGrid")).define("separatorGrid", ["spriteGrids"], function(spriteGrids) {
    return spriteGrids[10];
  });
  main.variable(observer("ticks")).define("ticks", function() {
    return [
      [1, 10],
      [0, 10],
      [0, 11],
      [0, 12],
      [0, 13],
      [0, 14],
      [0, 15],
      [0, 16],
      [0, 17],
      [0, 18],
      [0, 19],
      [1, 19],
      [2, 19],
      [3, 19],
      [4, 19],
      [5, 19],
      [6, 19],
      [7, 19],
      [7, 18],
      [7, 17],
      [7, 16],
      [7, 15],
      [7, 14],
      [7, 13],
      [7, 12],
      [7, 11],
      [7, 10],
      [6, 10],
      [6, 9],
      [7, 9],
      [7, 8],
      [7, 7],
      [7, 6],
      [7, 5],
      [7, 4],
      [7, 3],
      [7, 2],
      [7, 1],
      [7, 0],
      [6, 0],
      [5, 0],
      [4, 0],
      [3, 0],
      [2, 0],
      [1, 0],
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
      [0, 6],
      [0, 7],
      [0, 8],
      [0, 9],
      [1, 9]
    ];
  });
  main.variable(observer("settings")).define("settings", function() {
    return {
      fadeSeconds: 4,
      previewDate: new Date("2020-01-01T12:24"),
      radius: 30,
      speedup: 1
    };
  });
  main.variable(observer("clamp")).define("clamp", function() {
    return function clamp(normalizedTime) {
      return Math.min(Math.max(0, normalizedTime), 1);
    };
  });
  main.variable(observer("pixelsToHours")).define("pixelsToHours", ["hoursByOrientation"], function(hoursByOrientation) {
    return function pixelsToHours(pixels) {
      const getPixel = (i, j) => {
        if (i >= 0 && i < pixels.length && j >= 0 && j < pixels[i].length) {
          return pixels[i][j];
        } else {
          return 0;
        }
      };

      const grid = [];

      for (let i = 0; i <= pixels.length; i += 1) {
        const row = [];

        for (let j = 0; j <= pixels[0].length; j += 1) {
          let orientation = "empty";
          const blackPixels = getPixel(i, j) + getPixel(i - 1, j) + getPixel(i, j - 1) + getPixel(i - 1, j - 1);
          if (blackPixels === 2) {
            if (getPixel(i, j) === getPixel(i - 1, j)) {
              orientation = "vertical";
            } else {
              orientation = "horizontal";
            }
          } else if (blackPixels === 1 || blackPixels === 3) {
            const oddPixel = blackPixels === 1 ? 1 : 0;
            switch (oddPixel) {
              case getPixel(i, j):
                orientation = "top-left";
                break;
              case getPixel(i - 1, j):
                orientation = "bottom-left";
                break;
              case getPixel(i, j - 1):
                orientation = "top-right";
                break;
              case getPixel(i - 1, j - 1):
                orientation = "bottom-right";
                break;
            }
          }
          row.push(hoursByOrientation[orientation]);
        }
        grid.push(row);
      }
      return grid;
    };
  });
  main.variable(observer("isGeneratingThumbnail")).define("isGeneratingThumbnail", function() {
    return navigator.userAgent.match("HeadlessChrome");
  });
  main.variable(observer("useThumnailSize")).define("useThumnailSize", ["isGeneratingThumbnail", "digitalClock"], function(isGeneratingThumbnail, digitalClock) {
    if (isGeneratingThumbnail) {
      digitalClock.setAttribute("width", 640);
      digitalClock.setAttribute("height", 400);
      return true;
    }
    return false;
  });
  main.variable(observer("d3")).define("d3", ["require"], function(require) {
    return require("d3-ease@1", "d3-selection@1");
  });
  return main;
}
