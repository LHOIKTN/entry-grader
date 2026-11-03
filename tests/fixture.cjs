let id = 0;
const b = (type, params = [], statements = []) => ({
  id: "b" + ++id,
  type,
  params,
  statements,
  x: 0,
  y: 0,
});
const text = (s) => b("text", [String(s)]),
  answer = () => b("get_canvas_input_value", [null]),
  say = (v) =>
    b("dialog", [typeof v === "object" ? v : text(v), "speak", null]),
  ask = () => b("ask_and_wait", [text("값을 입력하세요"), null]);
function project(blocks) {
  return {
    name: "자동채점기 검증용",
    speed: 60,
    objects: [
      {
        id: "object1",
        name: "검증용 오브젝트",
        objectType: "sprite",
        rotateMethod: "free",
        scene: "scene1",
        sprite: {
          pictures: [
            {
              id: "pic1",
              name: "점",
              filename: "dot",
              fileurl:
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=",
              dimension: { width: 1, height: 1 },
              imageType: "png",
            },
          ],
          sounds: [],
        },
        selectedPictureId: "pic1",
        entity: {
          x: 0,
          y: 0,
          regX: 0,
          regY: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          direction: 90,
          width: 1,
          height: 1,
          visible: true,
        },
        script: JSON.stringify([
          [b("when_run_button_click", [null]), ...blocks],
        ]),
      },
    ],
    scenes: [{ id: "scene1", name: "장면 1" }],
    variables: [],
    messages: [],
    functions: [],
    tables: [],
  };
}
module.exports = { b, text, answer, say, ask, project };
