---
title: "ANR Multisc'in Videos"
layout: gridlay
excerpt: "ANR Multisc'in - Videos"
sitemap: false
permalink: /anrmultiscin_video
---

# Recorded ANR Multisc'in Videos and Talks

<!--{% assign number_printed = 0 %} -->
{% for video in site.data.video_list %}
- <strong>{{ video.title }}</strong>, {{ video.date }}: <strong><a href="{{ video.link }}">{{ video.display }}</a></strong>

{% endfor %}


