# EntryJS 실행 자산

`entry-runtime.tar.gz`는 플랫폼에 독립적인 브라우저 실행 자산입니다. 학생 제출물이나 명단은 포함하지 않습니다. `npm run prepare:runtime`이 SHA-256을 검사한 후 압축을 해제합니다.

EntryJS 4.0.22, source commit e303f805501604c07a96763633e522543788b221. 배포 JS 해시는 압축 안의 runtime/manifest.json에 기록되어 있습니다.

원본 소스:
- https://github.com/entrylabs/entryjs (Apache-2.0)
- https://github.com/entrylabs/entry-offline
- https://github.com/entrylabs/entry-tool

엔진과 라이브러리는 수정하지 않고 실행 자산으로 복사했습니다. 관련 라이선스는 압축 안의 runtime/licenses 및 배포 코드의 라이선스 주석을 참조하세요. 이 묶음은 준비 스크립트에 두 엔트리 소스 경로를 명시하여 다시 만들 수 있습니다.
