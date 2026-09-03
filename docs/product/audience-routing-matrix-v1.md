# Career Diya Audience Routing Matrix v1.0

| Audience | Definition | Questions answered by | Free output | Assessment route |
|---|---|---|---|---|
| Parent / school-stage | Parent acting for a school-age child | Parent about child | Broad child direction families + observational rationale | Co-branded age-designed school-stage assessment |
| Student 16+ | Late-school / college | Student about self | Broad personal directions + next tests | Career Diya RIASEC-42 (adult / 16-50) |
| Graduate / professional | Graduate / working professional | Person about self | Broad personal directions + next tests | Career Diya RIASEC-42 (adult / 16-50) |

## State

- URL parameter: `audience=parent|student|professional`
- Lightweight browser persistence allowed.
- Changeable at any time.
- Invalid / missing / cleared state → neutral experience.

## Neutral experience

Must clearly signal that Career Diya serves:

- parents choosing a direction for a child;
- 16+ students;
- graduates and professionals.

## Hard routing constraints

- Parent/school-stage → school-stage assessment only.
- Parent/school-stage → **never RIASEC-42**.
- Student → 16+ only.
- RIASEC-42 must not be presented as assessing a child under 16.
