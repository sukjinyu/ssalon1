# 에셋 기록

캐릭터는 원작 그래픽이나 외부 이미지 파일을 사용하지 않고 `src/style.css`의 CSS 픽셀 블록으로 그립니다.

주요 클래스:

- `.pixel-sprite`: 캐릭터 전체 크기와 기본 색상 변수
- `.pixel-kind-0` ~ `.pixel-kind-3`: 손님, 공주님, 왕자님, 직원 색상 차이
- `.style-cut`, `.style-dry`, `.style-color`, `.style-perm`, `.style-straight`, `.style-braid`, `.style-bridal`, `.style-makeup`: 첫 시술 후 보이는 결과 스타일
- `.work-zone`: 손님 앞에서만 시술할 수 있음을 보여주는 네모칸

초기 버전에서 생성했던 `public/characters.png`는 보관용 파일이며 현재 화면 렌더링에는 사용하지 않습니다. 원작 SWF나 원작 그래픽은 포함하지 않습니다.
