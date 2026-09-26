package com.devshield.backend.model;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class Signal {
    private String id;
    private int weight;
    private String detail;

    public Signal() {}

    public Signal(String id, int weight, String detail) {
        this.id = id;
        this.weight = weight;
        this.detail = detail;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public int getWeight() { return weight; }
    public void setWeight(int weight) { this.weight = weight; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
}
