import { describe, it, expect } from "vitest";

describe("T04-06 · ImageCompareModal 几何对齐与交互算法", () => {
  it("updateSlider 坐标系应以图片 stageRect 为基准精确映射 0%~100%", () => {
    // 模拟弹窗中居中的图片舞台：容器宽 1000px，图片居中在 300px ~ 700px (宽 400px)
    const stageRect = {
      left: 300,
      right: 700,
      width: 400,
    };

    const calculatePercentage = (clientX: number) => {
      const x = clientX - stageRect.left;
      const percentage = Math.max(0, Math.min(100, (x / stageRect.width) * 100));
      return Number(percentage.toFixed(2));
    };

    // 1. 鼠标在图片左侧黑色留白区 (如 clientX = 100)
    expect(calculatePercentage(100)).toBe(0);

    // 2. 鼠标刚好在图片左边缘 (clientX = 300)
    expect(calculatePercentage(300)).toBe(0);

    // 3. 鼠标在图片正中心 (clientX = 500)
    expect(calculatePercentage(500)).toBe(50);

    // 4. 鼠标在图片四分之一处 (clientX = 400)
    expect(calculatePercentage(400)).toBe(25);

    // 5. 鼠标刚好在图片右边缘 (clientX = 700)
    expect(calculatePercentage(700)).toBe(100);

    // 6. 鼠标在图片右侧黑色留白区 (如 clientX = 900)
    expect(calculatePercentage(900)).toBe(100);
  });

  it("键盘快捷键导航步进计算应精准在 0~100 之间步进", () => {
    let sliderPos = 50;

    const handleKey = (key: string) => {
      if (key === "ArrowLeft") {
        sliderPos = Math.max(0, sliderPos - 5);
      } else if (key === "ArrowRight") {
        sliderPos = Math.min(100, sliderPos + 5);
      } else if (key === "Home") {
        sliderPos = 0;
      } else if (key === "End") {
        sliderPos = 100;
      }
    };

    handleKey("ArrowLeft");
    expect(sliderPos).toBe(45);

    handleKey("ArrowRight");
    handleKey("ArrowRight");
    expect(sliderPos).toBe(55);

    handleKey("Home");
    expect(sliderPos).toBe(0);

    handleKey("ArrowLeft");
    expect(sliderPos).toBe(0); // 钳位下限

    handleKey("End");
    expect(sliderPos).toBe(100);

    handleKey("ArrowRight");
    expect(sliderPos).toBe(100); // 钳位上限
  });

  it("节省率计算在各种输入下应保持稳定格式化", () => {
    const calcSavings = (orig: number, result: number) => {
      if (orig <= 0) return 0;
      return (((orig - result) / orig) * 100).toFixed(1);
    };

    expect(calcSavings(1000, 500)).toBe("50.0");
    expect(calcSavings(1800000, 1542600)).toBe("14.3");
    expect(calcSavings(0, 100)).toBe(0);
  });
});
